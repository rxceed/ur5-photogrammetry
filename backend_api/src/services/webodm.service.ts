import "dotenv/config"
import  {type authModel,
                type projectModel,
                type taskModel } from "../models/webodm.model"
import { status } from "elysia"

const WEBODM_URI_BASE: string = (process.env.WEBODM_URI_BASE as string)

export abstract class WebODM_AuthService{
    static async tokenAuth({username, password}: authModel['authBody'])
    {
        const fetchData = {
            username: username,
            password: password
        }
        const url: string = `${WEBODM_URI_BASE}/api/token-auth/`;
        const res = await fetch(url, {
                    method: "POST",
                    body: new URLSearchParams(fetchData),
                });
        if(!res.ok) {
            const errorData = await res.json();
            throw status(500, JSON.stringify(errorData));
        }
        const resJSON = await res.json();
        return {
            token: resJSON.token
        };
    }
}

export abstract class WebODM_ProjectService{
    static async getProjectByName({name}: projectModel['projectBody'], token: string){
        const fetchData = {
            name: name
        }
        const url: string = `${WEBODM_URI_BASE}/api/projects/?name=${fetchData.name}`
        const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Authorization: `JWT ${token}`
                    }
                })
        if(!res.ok) {
            const errorData = await res.json();
            throw status(500, `Internal Server Error: ${JSON.stringify(errorData)}`);
        }
        const resJSON = await res.json()
        
        // Log the response from WebODM for debugging intermittent validation errors
        console.log(`WebODM Search Response for "${name}":`, JSON.stringify(resJSON, null, 2));
        
        // WebODM search by name returns a paginated list
        let project: any;
        if (resJSON.results && Array.isArray(resJSON.results)) {
            project = resJSON.results.find((p: any) => p.name === name) || resJSON.results[0];
        } else if (Array.isArray(resJSON)) {
            project = resJSON.find((p: any) => p.name === name) || resJSON[0];
        } else if (resJSON && typeof resJSON === 'object' && resJSON.id) {
            // Direct object response (unlikely for search but just in case)
            project = resJSON;
        }
        
        if (!project) {
            throw status(404, "Project not found");
        }

        return {
            id: project.id,
            tasks: project.tasks || [],
            created_at: project.created_at,
            name: project.name,
            description: project.description,
            permissions: project.permissions || [],
        }
    }
    
    static async createProject({name, description}: projectModel['projectBody'], token: string){
        const fetchData = {
            name: name,
            description: description || ""
        }
        const url: string = `${WEBODM_URI_BASE}/api/projects/`
        const res = await fetch(url, {
                    method: 'POST',
                    body: new URLSearchParams(fetchData),
                    headers: {
                        Authorization: `JWT ${token}`
                    }
                })
        if(!res.ok) {
            const errorData = await res.json();
            throw status(500, JSON.stringify(errorData));
        }
        const resJSON = await res.json()
        return {
            id: resJSON.id,
            tasks: resJSON.tasks || [],
            created_at: resJSON.created_at,
            name: resJSON.name,
            description: resJSON.description,
            permissions: resJSON.permissions || [],
        }
    }
}

export abstract class WebODM_TaskService{
    static async createWebODMTask({projectId, name, images}: taskModel['taskBody'], token: string,){
        const fetchData = {
            projectId: projectId,
            name: name
        }
        const url = `${WEBODM_URI_BASE}/api/projects/${projectId}/tasks/`;
        const taskOptions = [{"name":"auto-boundary","value":true},
            {"name":"use-hybrid-bundle-adjustment","value":true},
            {"name":"mesh-octree-depth","value":"12"},
            {"name":"skip-orthophoto","value":true},
            {"name":"pc-quality", "value":"high"},
            {"name":"mesh-size", "value":300000},
            {"name":"bg-removal", "value":true},
            {"name":"gltf", "value":true}]
        // 1. Prepare FormData (required for multipart/form-data)
        const formData = new FormData();
        // 2. Append images (WebODM expects the key "images")
        // Note: Even though the docs say "images[]", in Fetch/FormData 
        // you usually append to the same key multiple times.
        images.forEach((file) => {
            formData.append("images", file);
        });

        // 3. Add task metadata
        formData.append("name", fetchData.name);
        formData.append("auto_processing_node", "true");

        // 4. Add options (Must be a JSON-stringified array)
        if (taskOptions.length > 0) {
            formData.append("options", JSON.stringify(taskOptions));
        }

        // 5. Send the request
        const res = await fetch(url, {
            method: "POST",
            headers: {
            // NOTE: Do NOT manually set 'Content-Type'. 
            // The browser will automatically set it to 'multipart/form-data' 
            // with the correct boundary string.
                Authorization: `JWT ${token}`,
            },
            body: formData,
        });

        if(!res.ok) {
            const errorData = await res.json();
            throw status(500, JSON.stringify(errorData));
        }
        const resJSON = await res.json()
        return {
            id: resJSON.id,
            project: resJSON.project,
            processing_node: resJSON.processing_node,
            processing_node_name: resJSON.processing_node_name,
            images_count: resJSON.images_count,
            can_rerun_from: resJSON.can_rerun_from,
            available_assets: resJSON.available_assets,
            uuid: resJSON.uuid,
            name: resJSON.name,
            processing_time: resJSON.processing_time,
            auto_processing_node: resJSON.auto_processing_node,
            status: resJSON.status,
            last_error: resJSON.last_error,
            options: resJSON.options,
            created_at: resJSON.created_at,
            pending_action: resJSON.pending_action,
            upload_progress: resJSON.upload_progress,
            resize_progress: resJSON.resize_progress,
            running_progress: resJSON.running_progress
        }
    }

    static async streamTaskModel(projectId: string, taskId: string, token: string) {
        // 1. Get task details to find available assets
        const taskUrl = `${WEBODM_URI_BASE}/api/projects/${projectId}/tasks/${taskId}/`;
        const taskRes = await fetch(taskUrl, {
            headers: { Authorization: `JWT ${token}` }
        });
        
        if (!taskRes.ok) {
            const errorData = await taskRes.json();
            throw status(500, `Failed to fetch task details: ${JSON.stringify(errorData)}`);
        }
        
        const taskData = await taskRes.json() as any;
        const assets: string[] = taskData.available_assets || [];
        const glbAsset = assets.find(asset => asset.toLowerCase().endsWith('.glb'));
        
        if (!glbAsset) {
            throw status(404, "GLB model not found for this task. Ensure 'gltf' option was enabled and task is complete.");
        }
        
        // 2. Fetch the actual asset stream
        const downloadUrl = `${WEBODM_URI_BASE}/api/projects/${projectId}/tasks/${taskId}/download/${glbAsset}`;
        const downloadRes = await fetch(downloadUrl, {
            headers: { Authorization: `JWT ${token}` }
        });
        
        if (!downloadRes.ok) {
            throw status(500, `Failed to download model asset: ${downloadRes.statusText}`);
        }
        
        return downloadRes;
    }

    static async getTasksByProject(projectId: string, token: string) {
        const url = `${WEBODM_URI_BASE}/api/projects/${projectId}/tasks/`;
        const res = await fetch(url, {
            headers: { Authorization: `JWT ${token}` }
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw status(500, `Failed to fetch tasks for project ${projectId}: ${JSON.stringify(errorData)}`);
        }
        
        return await res.json();
    }
}