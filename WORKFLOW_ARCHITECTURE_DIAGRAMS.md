# Workflow Integration System - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AVA CRM - WORKFLOW SETUP                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Select Object          Step 2: Select Template            │
│  ┌─────────────┐               ┌─────────────────┐                │
│  │   Leads     │               │ Contact Inquiry │                │
│  │   Contacts  │  ────────>    │ Demo Request    │                │
│  │   Accounts  │               │ Trial Signup    │                │
│  └─────────────┘               └─────────────────┘                │
│                                                                     │
│  Step 3: Map Fields             Step 4: Get Webhook                │
│  ┌────────────────────────┐    ┌───────────────────────┐          │
│  │ name  → Full Name      │    │ Webhook URL:          │          │
│  │ email → Email Address  │    │ https://...?wfId=123  │          │
│  │ phone → Phone Number   │    │ [Copy Code]           │          │
│  └────────────────────────┘    └───────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Generates
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL WEBSITE FORM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  <form id="contactForm">                                            │
│    <input name="name" />                                            │
│    <input name="email" />                                           │
│    <input name="phone" />                                           │
│    <button>Submit</button>                                          │
│  </form>                                                            │
│                                                                     │
│  <script>                                                           │
│    // On submit → POST to webhook URL                              │
│  </script>                                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST Request
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUD FUNCTION (submitFormData)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Receive form data + workflow ID                                 │
│  2. Load workflow configuration from Firestore                      │
│  3. Map form fields to CRM fields                                   │
│  4. Create object in /objects collection                            │
│  5. Create record in /records collection                            │
│  6. Send email notifications (if configured)                        │
│  7. Return success response                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Writes to
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FIRESTORE DATABASE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /businesses/{id}/objects/{objectId}                                │
│  ├── docId: "object_123..."                                         │
│  ├── typeOfObject: "Leads"                                          │
│  ├── fullName: "John Doe"                                           │
│  ├── email: "john@example.com"                                      │
│  └── ...                                                            │
│                                                                     │
│  /businesses/{id}/records/{recordId}                                │
│  ├── docId: "record_456..."                                         │
│  ├── linkId: "object_123..." ← Links to object                     │
│  ├── typeOfRecord: "Contact Inquiry"                                │
│  ├── fullName: "John Doe"                                           │
│  ├── email: "john@example.com"                                      │
│  └── ...                                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Real-time updates
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          AVA CRM - SHEETS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  New lead appears automatically in sheet!                           │
│  ┌─────────────┬──────────────────┬──────────────┐                 │
│  │ Name        │ Email            │ Phone        │                 │
│  ├─────────────┼──────────────────┼──────────────┤                 │
│  │ John Doe    │ john@example.com │ 555-123-4567 │ ← NEW!          │
│  └─────────────┴──────────────────┴──────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
External Website                Cloud Function              AVA CRM
     Form                      submitFormData               Firestore
       │                             │                         │
       │                             │                         │
       │  POST {name, email, ...}    │                         │
       ├─────────────────────────────>                         │
       │     ?wfId=workflow_123      │                         │
       │                             │                         │
       │                             │  Get workflow config    │
       │                             ├────────────────────────>│
       │                             │                         │
       │                             │  Return config          │
       │                             <────────────────────────┤
       │                             │  (fieldMappings, etc)   │
       │                             │                         │
       │                             │  Map fields             │
       │                             │  name → fullName        │
       │                             │  email → email          │
       │                             │                         │
       │                             │  Create object          │
       │                             ├────────────────────────>│
       │                             │                         │
       │                             │  Object created ✓       │
       │                             <────────────────────────┤
       │                             │                         │
       │                             │  Create record          │
       │                             ├────────────────────────>│
       │                             │  (linked to object)     │
       │                             │                         │
       │                             │  Record created ✓       │
       │                             <────────────────────────┤
       │                             │                         │
       │                             │  Send email (optional)  │
       │                             │  to sales@company.com   │
       │                             │                         │
       │  {success: true, ...}       │                         │
       <─────────────────────────────┤                         │
       │                             │                         │
       │                             │                         │
  Show success                       │                    Real-time
   message                           │                     listener
       │                             │                    triggers
       │                             │                         │
       │                             │                    Update UI
       │                             │                    in Sheets
```

---

## Workflow Configuration Structure

```
/businesses/{businessId}
    /workflows
        /{workflowId}
            ├── workflowId: "workflow_123..."
            ├── name: "Contact Form Leads"
            ├── status: "active"
            ├── createdAt: Timestamp
            └── createdBy: "user_uid"
            
            /config
                /main
                    ├── mapping
                    │   ├── objectType: "Leads"
                    │   ├── objectId: "obj_abc"
                    │   ├── recordTemplate: "Contact Inquiry"
                    │   ├── templateId: "template_xyz"
                    │   ├── sheetName: "New Leads"
                    │   └── fieldMappings: [...]
                    │
                    ├── notifications
                    │   ├── emailOnSubmission: true
                    │   └── emailsToNotify: ["sales@company.com"]
                    │
                    └── autoActions
                        ├── assignToUser: "user_789"
                        └── addToSheet: "Lead Sheet"
```

---

## Component Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Workflows.jsx                           │
│  Main workflows page with workflow list                      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Renders when workflow selected
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  WorkflowBuilder.jsx                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Step 1: Object Selection                          │    │
│  │  - Grid of available objects                       │    │
│  │  - Fetched from templateObjects context            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Step 2: Template Selection                        │    │
│  │  - Grid of templates for selected object           │    │
│  │  - Filtered by objectId                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Step 3: Field Mapping                             │    │
│  │  - Dynamic form for field mappings                 │    │
│  │  - Form field name → CRM field dropdown            │    │
│  │  - Email notification settings                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Step 4: Webhook URL                               │    │
│  │  - Display generated webhook URL                   │    │
│  │  - Copy button                                     │    │
│  │  - Integration code sample                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Field Mapping Flow

```
Form Field Name          CRM Field Path              Firestore Field
     (Input)           (Selected from dropdown)        (Written to)
        │                        │                          │
        │                        │                          │
    "name"           "basicFields.fullName"          "fullName"
        │                        │                          │
        ├────────────────────────┼──────────────────────────>
        │                        │                          │
    "email"          "basicFields.email"              "email"
        │                        │                          │
        ├────────────────────────┼──────────────────────────>
        │                        │                          │
    "message"        "templateFields.inquiry"        "inquiry"
        │                        │                          │
        └────────────────────────┴──────────────────────────>
```

---

## Integration Examples Flow

### Example 1: Simple HTML Form
```
User fills form → JavaScript captures data → POST to webhook → 
Object created → Record created → Success message shown
```

### Example 2: React Multi-Step Form
```
User completes Step 1 → State updated → 
User completes Step 2 → State updated → 
User clicks "Submit" → All data sent to webhook →
Object & record created → Redirect to thank you page
```

### Example 3: WordPress Contact Form 7
```
User submits CF7 form → WordPress hook triggered →
PHP sends data to webhook → Object & record created →
WordPress continues normal flow
```

---

## Security Flow

```
External Request
       │
       ▼
Cloud Function
       │
       ├─ Check: Valid workflow ID?
       │    │
       │    ├─ No → Return 404
       │    │
       │    └─ Yes
       │         │
       │         ▼
       ├─ Load workflow config from Firestore
       │         │
       │         ▼
       ├─ Validate: Config exists?
       │    │
       │    ├─ No → Return 400
       │    │
       │    └─ Yes
       │         │
       │         ▼
       ├─ Map fields according to config
       │         │
       │         ▼
       ├─ Create object & record
       │         │
       │         ▼
       └─ Return success
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Form Submission                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Network Available?   │
              └──────────┬────────────┘
                    Yes  │  No
                         │  └─> Show "No connection" error
                         ▼
              ┌───────────────────────┐
              │  Workflow ID Valid?   │
              └──────────┬────────────┘
                    Yes  │  No
                         │  └─> Show "Workflow not found" error
                         ▼
              ┌───────────────────────┐
              │  Config Loaded OK?    │
              └──────────┬────────────┘
                    Yes  │  No
                         │  └─> Show "Configuration error"
                         ▼
              ┌───────────────────────┐
              │  Fields Mapped OK?    │
              └──────────┬────────────┘
                    Yes  │  No
                         │  └─> Show "Invalid data" error
                         ▼
              ┌───────────────────────┐
              │  Object Created OK?   │
              └──────────┬────────────┘
                    Yes  │  No
                         │  └─> Show "Creation failed" error
                         ▼
              ┌───────────────────────┐
              │  Record Created OK?   │
              └──────────┬────────────┘
                    Yes  │  No
                         │  └─> Show "Record failed" error
                         ▼
                  ┌──────────────┐
                  │   SUCCESS!   │
                  └──────────────┘
```

---

This visual guide should help understand how all the pieces fit together! 🎨
