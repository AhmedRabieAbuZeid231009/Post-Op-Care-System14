POST-OP CARE — FRONT-END PROTOTYPE (VERSION 14)
================================================

HOW TO OPEN
1. Extract the ZIP file.
2. Open the Post-Op-Care-System folder.
3. Double-click index.html in Chrome or Edge.
4. Keep index.html, app.js, style.css, and images/ together.
5. No server, Java, build tool, or internet connection is required for the demo.

DEMO ACCOUNTS
Doctor:  doctor@postopcare.com / 123456
Patient: patient@postopcare.com / 123456
Doctor display name: Dr. Ahmed Rabie

ROLE SEPARATION
- Patient login opens Patient Dashboard and only patient pages: Patient Dashboard, Daily Check-in, Medication & Wound Care, and Messages.
- Doctor login opens Doctor Dashboard and only doctor pages: Doctor Dashboard, Patient Details & Reports, and Messages.
- The workspaces are separate. A logged-in patient cannot open doctor pages through navigation, and vice versa.
- Public registration is for patients only. Doctor accounts must be created/provisioned by the system administrator and then used to log in. This prevents anyone from publicly registering as a doctor.

PATIENT-DOCTOR COMMUNICATION
- The patient opens Messages and sends a question/update to the assigned doctor.
- The doctor opens Messages, chooses a patient, reads that patient's conversation, and replies.
- Messages show the sender, role, and timestamp.
- For demonstration, messages are saved in localStorage in the same browser. They do not reach a different computer, phone, or actual doctor. Real cross-device communication requires a backend, database, authentication, and secure API.

RECOVERY / CARE-PLAN COMPLETION PERCENTAGE
The displayed percentage is intended to represent completion of the post-operative follow-up care plan. It is NOT a medical measurement of wound healing, a probability that the patient will recover, or a prediction of recovery time.
Example model for a clinician-configured plan:
- Daily check-ins completed: 25% weight.
- Medication tracking/adherence documented: 25% weight.
- Wound-care updates submitted and reviewed: 25% weight.
- Scheduled follow-up/review milestones completed: 25% weight.
Each category's completion is scored from documented evidence, then multiplied by its assigned weight and summed. Example: if check-ins are 100% complete, medication tracking 80%, wound updates 60%, and follow-up 50%, the illustrative score is (100×0.25)+(80×0.25)+(60×0.25)+(50×0.25)=72.5%.
The treating clinician must define milestones and weights appropriate to the operation. Missing information must be treated as unknown, not automatically complete. The existing patient percentages are sample values and require clinician review; this prototype does not yet calculate the weighted score automatically.

THE SIX REQUIRED CORE SCREENS
1. Login & Registration
2. Patient Dashboard
3. Daily Check-in
4. Medication & Wound Care
5. Doctor Dashboard
6. Patient Details & Reports
Additional screen: Messages.

OTHER FEATURES
- Patient daily symptom/vital check-ins.
- Doctor alerts for concerning demo readings.
- Medication status tracking and wound photo upload.
- Doctor patient directory, record review, and printable report.
- Browser-local storage for demo accounts, patient records, check-ins, wound photos, medication states, and messages.

IMPORTANT LIMITATION
This is an academic front-end prototype, not production clinical software. Data is stored only in the current browser and is not transmitted to a doctor or hospital. It is not a secure medical record system and must not be used for real patient-identifiable information or urgent care. Demo readings, medication names, photos, percentages, and patient records are illustrative. For urgent symptoms, patients must contact emergency services or their healthcare provider directly.


PATIENT REGISTRATION AND DOCTOR LINKING (V14 FRONT-END FLOW)
- Patient registration now collects full name, email, password, sex, phone, surgery/procedure, surgery date, and the treating doctor's invitation code.
- The demo doctor account displays its invitation code on the Doctor Dashboard: AHMED123.
- A patient must enter a valid code to finish registration. The patient record stores the matching doctor's email as assignedDoctorEmail.
- After registration, the patient opens their own Patient Dashboard. When the doctor signs in on the same browser, that patient appears in the doctor's assigned patient list and Patient Details & Reports.
- Daily check-ins, wound photo metadata/data, and messages are associated with the patient's email for the demo flow.
- Doctors only see records assigned to their own doctor account in the dashboard, alerts, patient directory, and message list.

IMPORTANT FRONT-END / BACKEND BOUNDARY
- This is still a front-end academic prototype. Browser localStorage is shared only within the same browser profile on the same device. It does not transmit registration, check-ins, wound photos, or messages to a different device.
- The backend teammate must implement secure account authentication, doctor invitation-code validation, database relations (patient -> doctor), API endpoints, file upload storage, and real-time or refreshed message delivery. The frontend currently models the expected flow and stores demo data locally so it can be demonstrated without the backend.
- The invitation code shown here is a demo code, not a secure credential. Do not use real patient-identifiable information in this prototype.
