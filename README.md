# MindEcho — ADHD Screening Platform

Mindecho ia an AI-based behavioral and cognitive screening platform for early ADHD-related indicators in children. It combines eye movement analysis, body movement tracking, and speech analysis to generate an assessment report for teachers and educational support environments.

## Features
- User registration and login
- Password reset with OTP
- Child profile creation
- New assessment workflow
- Eye movement analysis
- Body movement tracking
- Speech analysis
- Combined ADHD likelihood result
- Past reports dashboard
- Report details and history

## Technologies Used
### Backend
- Python
- FastAPI
- SQLModel
- SQLite
- Uvicorn

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### AI / Analysis
- OpenCV
- MediaPipe
- TensorFlow / Keras
- Scikit-learn
- Librosa
- Faster-Whisper
- GRU (Gated Recurrent Unit)
- Random Forest

### Tools
- Visual Studio Code
- Node.js
- GitHub

## Project Structure
mindecho/
|
|-backend/
|   |-app/
|   |   |-models/           # Database models and schema definitions
|   |   |-routers/          # API route handlers
|   |   |-services/         # Analysis and processing logic
|   |   |-utils/            # Helper and authentication utilities
|   |-data/                 # Stored session and analysis data
|   |-uploads/              # Uploaded files for processing
|   |-main.py              # FastAPI application entry point
|   |-requirements.txt     # Python backend dependencies
|   |-.env.example
|
|-frontend/
|   |-public/               # Static assets
|   |-src/           
|   |   |-api/              # API client and endpoint handling
|   |   |-components/       # Reusable UI components
|   |   |-hooks/            # Custom React hooks
|   |   |-pages/            # Application pages
|   |   |-types/            # TypeScript type definitions
|   |   |-App.tsx           # Main app component
|   |   |-index.css         # Global styles
|   |   |-main.tsx          # Frontend entry point
|   |-index.html            # Main HTML entry file
|   |-package.json          # Frontend dependencies
|   |-tailwind.config.js    # Tailwind CSS configuration
|   |-tsconfig.json         # TypeScript configuration
|   |-vite.config.ts        # Vite configuration
|
|-README.md

## Running the Project

### Quick Start
For quick local testing, double-click `quickstart_mindecho.bat` to automatically start both the backend and frontend.

> Note: The `quickstart_mindecho.bat` file uses local Windows file paths and may need to be updated before running on another machine.

## Installation and Setup

### Backend
1. Navigate to the backend folder:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
venv\Scripts\activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Run the backend:
```bash
uvicorn main:app --reload
```

### Frontend
1. Navigate to the frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the frontend:
```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the `backend` folder using `.env.example` as a reference.

Example:

```env
SECRET_KEY=your_secret_key_here
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DATABASE_URL=sqlite:///./mindecho.db
UPLOAD_DIR=./uploads

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
EMAIL_FROM=your_email@gmail.com

EYE_CAM_INDEX=2
BODY_CAM_INDEX=1
```

For security reasons, the project does not include the original SMTP email password used during development. To enable OTP email delivery, valid SMTP credentials must be configured locally in the `.env` file.

If SMTP credentials are not configured, OTP emails will not be sent and the OTP will instead be printed in the backend terminal by leaving the fields blank for testing purposes.

## User Guide

### 1. Register or Log In
When the application starts, the user can create a new account by registering with their email, full name, and password. Existing users can log in using their registered email and password.

### 2. Reset Password
If the user forgets their password, they can select the forgot password option. The system sends a one-time password (OTP) to the registered email address. After entering the OTP, the user can create a new password.

### 3. Access the Dashboard
After logging in, the user is taken to the dashboard. From here, the user can:
- start a new assessment
- view previous reports
- manage their profile

### 4. Start a New Assessment
The user clicks the Start New Assessment button.

### 5. Enter Student Details
On the next page, the user enters the student’s details, such as:
- full name
- birth date
- class name
- teacher name
- assessment date

This information is saved as part of the assessment record.

### 6. Check Camera Setup
After entering the student details, the user proceeds to the camera setup page. Here, the user checks that the required camera devices are connected and ready for the assessment.

### 7. Start Recording
Once the camera setup is complete, the user clicks the Start Recording button to begin the assessment process.

### 8. Body Tracking
The system first starts the body tracking stage. During this stage, the child’s body movement is monitored and recorded. This stage runs for 5 minutes.

### 9. Eye Analysis and Speech Analysis
After the body tracking stage is completed, the Next button opens the next page, where eye analysis and speech analysis are performed. During the speech analysis stage, the teacher asks the child questions while the system records and analyzes the child’s responses.

### 10. End the Test
After the eye and speech analysis stages are completed, the user clicks the End Test button to finish the assessment.

### 11. Process and Combine Results
The system then moves to the results processing stage, where the outputs from:
- body tracking
- eye analysis
- speech analysis

are analyzed and combined.

### 12. View Final Result
After processing is complete, MindEcho generates a final ADHD likelihood result in one of three categories:
- Low
- Medium
- High

### 13. View and Download the Report
The teacher is then shown the final report, which includes the assessment details and final screening result. The report can also be downloaded for future reference.

### 14. Access Past Reports
Previously completed reports can be accessed later from the dashboard by clicking View past reports button.

### 15. Update Profile
The user can also edit profile details such as full name and phone number from the profile section.


## Notes
- MindEcho is intended as a support tool for early screening and is not a clinical diagnostic system.
- The project is designed for educational use to help teachers identify behavioral patterns that may require further professional evaluation.

## Team
- Bushra Siddiqui
- Kainaz Chohan
- Diya Ashique
- Mahsa Mozafari
- Erfan Hatampour