# Camera Capture Interface for UR5 Photogrammetry

Camera Capture Interface adalah program C++ berbasis OpenCV untuk mengambil gambar otomatis berdasarkan trigger dari UR5.

Sistem ini digunakan untuk workflow photogrammetry, OpenSfM, atau WebODM. UR5 bergerak ke beberapa waypoint, lalu setiap waypoint memberikan sinyal digital output agar komputer mengambil satu gambar.

---

## System Overview

Final architecture:

```text
PC / Laptop
   |
   | HTTP POST
   v
Relay Controller
   |
   v
UR5 starts waypoint sequence
   |
   | DO[0] HIGH at each waypoint
   v
Input Controller Pin 33
   |
   | HTTP GET /input
   v
C++ Camera Interface
   |
   v
Capture image with OpenCV
```

Program PC hanya bertugas untuk:

```text
1. Mengirim start pulse ke UR5 melalui relay/1
2. Membaca status input pin dari endpoint /input
3. Mendeteksi pin 33 rising edge
4. Mengambil gambar menggunakan OpenCV
5. Menyimpan gambar dan metadata
```

Waypoint sepenuhnya dikontrol oleh program UR5, bukan oleh program PC.

---

## Final System Contract

### PC to UR5

Program mengirim sinyal start sequence ke UR5 melalui relay:

```text
POST http://192.168.200.219/relay/1
```

Relay dikirim sebagai pulse:

```text
state=on
delay 300 ms
state=off
```

### UR5 to PC

UR5 memberi sinyal capture menggunakan DO[0].

DO[0] dari UR5 dibaca oleh input controller sebagai:

```text
pin 33
```

Program akan capture gambar saat pin 33 berubah:

```text
0 -> 1
```

Program tidak capture terus-menerus saat pin 33 tetap HIGH.

---

## Endpoint

### Read Input Pin

```http
GET http://192.168.200.219/input
```

Contoh response:

```json
{
  "inputs": [
    {
      "pin": 25,
      "state": 0
    },
    {
      "pin": 33,
      "state": 0
    },
    {
      "pin": 32,
      "state": 0
    }
  ]
}
```

Pin trigger utama:

```text
pin 33
```

---

### Start UR5 Sequence

```http
POST http://192.168.200.219/relay/1
```

Test manual:

```bash
curl -X POST -d "state=on" http://192.168.200.219/relay/1
sleep 0.3
curl -X POST -d "state=off" http://192.168.200.219/relay/1
```

Jika muncul error:

```text
No 'state' parameter found. Use 'on' or 'off'
```

berarti request harus menggunakan body:

```bash
-d "state=on"
```

---

## Timing Requirement

Karena program membaca pin melalui HTTP polling, sinyal DO[0] dari UR5 tidak boleh terlalu cepat.

Rekomendasi:

```text
DO[0] HIGH minimal 300-500 ms
```

Recommended UR5 logic:

```text
Move to waypoint
Wait until robot stable
Set DO[0] = HIGH
Wait 500 ms
Set DO[0] = LOW
Move to next waypoint
```

Jangan menyalakan DO[0] saat robot masih bergerak, karena gambar bisa blur.

---

## Folder Structure

```text
camera_interface/
├── CMakeLists.txt
├── README.md
├── include/
│   ├── CameraCapture.hpp
│   ├── CaptureController.hpp
│   ├── HttpClient.hpp
│   ├── JsonInputParser.hpp
│   ├── PinSnapshot.hpp
│   └── Utils.hpp
├── src/
│   ├── CameraCapture.cpp
│   ├── CaptureController.cpp
│   ├── HttpClient.cpp
│   ├── JsonInputParser.cpp
│   ├── main.cpp
│   └── Utils.cpp
└── scripts/
    ├── config.env
    ├── install_deps.sh
    ├── build.sh
    └── run_capture.sh
```

---

## Installation

Install dependencies:

```bash
cd camera_interface

./scripts/install_deps.sh
```

Dependencies:

```text
- C++17 compiler
- CMake
- OpenCV
- libcurl
- nlohmann-json
- v4l-utils
- ffmpeg
```

---

## Build

```bash
cd camera_interface

./scripts/build.sh
```

Executable output:

```text
build/ur5_capture
```

---

## Run

```bash
cd camera_interface

./scripts/run_capture.sh
```

Program behavior:

```text
1. Open camera
2. Read input endpoint
3. Wait until pin 33 LOW
4. Send start pulse to relay/1
5. Wait for UR5 trigger from pin 33
6. Capture one image on pin 33 rising edge
7. Wait until pin 33 LOW again
8. Repeat until max capture count is reached
```

---

## Configuration

Configuration file:

```text
scripts/config.env
```

Example:

```bash
#!/usr/bin/env bash

INPUT_URL="http://192.168.200.219/input"
START_RELAY_URL="http://192.168.200.219/relay/1"

DATASET_DIR="../dataset"

PHOTO_TRIGGER_PIN=33
CAMERA_INDEX=0
MAX_CAPTURES=16

BUILD_DIR="build"
EXECUTABLE_NAME="ur5_capture"
```

Variable explanation:

| Variable | Description |
|---|---|
| `INPUT_URL` | Endpoint for reading input pin states |
| `START_RELAY_URL` | Endpoint for starting UR5 sequence |
| `DATASET_DIR` | Output dataset directory |
| `PHOTO_TRIGGER_PIN` | Input pin used as photo trigger |
| `CAMERA_INDEX` | OpenCV camera index |
| `MAX_CAPTURES` | Maximum number of images to capture |
| `BUILD_DIR` | Build output directory |
| `EXECUTABLE_NAME` | Executable name |

---

## Output

Captured images are saved into:

```text
dataset/images/
```

Example output:

```text
dataset/
├── images/
│   ├── img_00001.jpg
│   ├── img_00002.jpg
│   ├── img_00003.jpg
│   └── ...
└── metadata.jsonl
```

Each capture also writes metadata into:

```text
metadata.jsonl
```

---

## Camera Index Check

Check available camera devices:

```bash
ls /dev/video*
```

Check device details:

```bash
v4l2-ctl --list-devices
```

Test camera manually:

```bash
ffplay /dev/video0
```

If camera is on `/dev/video2`, set:

```bash
CAMERA_INDEX=2
```

inside:

```text
scripts/config.env
```

---

## Manual Test

### Test input endpoint

```bash
curl http://192.168.200.219/input
```

### Monitor input state

```bash
watch -n 0.1 'curl -s http://192.168.200.219/input'
```

Expected trigger behavior:

```text
pin 33: 0 -> 1 -> 0
```

### Test start relay

```bash
curl -X POST -d "state=on" http://192.168.200.219/relay/1
sleep 0.3
curl -X POST -d "state=off" http://192.168.200.219/relay/1
```

---

## Trigger Logic

The program uses rising edge detection.

| Previous pin 33 | Current pin 33 | Action |
|---:|---:|---|
| 0 | 0 | No capture |
| 0 | 1 | Capture one image |
| 1 | 1 | No repeated capture |
| 1 | 0 | Reset and wait for next trigger |

This prevents the program from capturing multiple images while DO[0] is still HIGH.

---

## Troubleshooting

### Empty Camera Frame

Symptom:

```text
[WARN] Empty camera frame
```

Check camera:

```bash
ls /dev/video*
v4l2-ctl --list-devices
ffplay /dev/video0
ffplay /dev/video1
ffplay /dev/video2
```

If needed, update:

```bash
CAMERA_INDEX=2
```

Check if camera is used by another process:

```bash
fuser /dev/video*
```

Kill process if necessary:

```bash
kill -9 <PID>
```

Check permission:

```bash
groups
```

If user is not in `video` group:

```bash
sudo usermod -aG video $USER
```

Then logout-login or reboot.

---

### Program Does Not Capture

Monitor input:

```bash
watch -n 0.1 'curl -s http://192.168.200.219/input'
```

Make sure pin 33 changes:

```text
0 -> 1 -> 0
```

Possible causes:

```text
1. UR5 DO[0] is not connected to input pin 33
2. Ground is not common
3. UR5 output logic is wrong
4. DO[0] HIGH duration is too short
5. Wrong input pin is configured
```

---

### Start Relay Does Not Work

Test:

```bash
curl -X POST -d "state=on" http://192.168.200.219/relay/1
sleep 0.3
curl -X POST -d "state=off" http://192.168.200.219/relay/1
```

If this fails, fix relay endpoint first before running the C++ program.

---

## Photogrammetry Notes

For better OpenSfM/WebODM results:

```text
- Avoid motion blur
- Keep lighting stable
- Keep object in frame
- Use textured objects
- Avoid transparent or reflective objects
- Keep enough overlap between images
- Use more images if reconstruction is weak
```

16 images can work for a demo, but for stronger reconstruction, use:

```text
24-60 images
```

---

## Quick Start

```bash
cd camera_interface

./scripts/install_deps.sh

./scripts/build.sh

./scripts/run_capture.sh
```
