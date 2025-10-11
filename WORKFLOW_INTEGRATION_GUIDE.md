# 🚀 AVA CRM Workflow Integration System

## Overview

The Workflow Integration System allows external websites to submit form data to AVA CRM, automatically creating objects and records based on predefined mappings. This eliminates the need for manual data entry and provides seamless integration between your website and AVA CRM.

---

## 🎯 Key Features

- **Visual Workflow Builder**: Map form fields to CRM fields without coding
- **Template-Based Structure**: Works with your existing templateObjects
- **Flexible Field Mapping**: Support for both basic fields and template-specific fields
- **Automatic Object Creation**: Creates objects and records based on configuration
- **Email Notifications**: Optional email alerts on form submissions
- **Secure Webhook URL**: Unique URL per workflow for secure data transmission
- **Easy Integration**: Simple copy-paste code for any website

---

## 📋 How It Works

```
External Website Form
    ↓
    POST request with form data
    ↓
Cloud Function (submitFormData)
    ↓
Load Workflow Configuration
    ↓
Map Form Fields → CRM Fields
    ↓
Create Object & Record in Firestore
    ↓
Send Notifications (optional)
```

---

## 🛠️ Setup Guide

### Step 1: Create a Workflow

1. Navigate to **Workflows** in AVA CRM
2. Click **"New Workflow"**
3. Enter a name (e.g., "Contact Form Leads")
4. Click **"Create Workflow"**

### Step 2: Configure Object & Template

1. Select your newly created workflow
2. **Step 1**: Choose which **Object Type** to create (e.g., "Leads")
3. **Step 2**: Choose which **Record Template** to use

### Step 3: Map Form Fields

1. **Step 3**: Add field mappings
   - **Form Field**: The name attribute from your HTML form (e.g., "email")
   - **CRM Field**: The corresponding field in your CRM (e.g., "Email Address (Object Field)")

Example mappings:
- `name` → `Full Name (Object Field)`
- `email` → `Email (Object Field)`
- `phone` → `Phone Number (Object Field)`
- `message` → `Inquiry Message (Template Field)`

2. (Optional) Add email notifications
3. (Optional) Configure sheet assignment

### Step 4: Get Webhook URL

1. **Step 4**: Copy your unique webhook URL
2. Copy the integration code provided
3. Add it to your website

---

## 💻 Integration Examples

### Basic HTML Form

```html
<form id="contactForm">
  <input name="name" placeholder="Your Name" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Phone">
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const response = await fetch('YOUR_WEBHOOK_URL_HERE', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      alert('Thank you! We\'ll be in touch soon.');
      e.target.reset();
    }
  } catch (error) {
    alert('Error submitting form. Please try again.');
  }
});
</script>
```

### React/Next.js Form

```jsx
import { useState } from 'react';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('YOUR_WEBHOOK_URL_HERE', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Thank you! We\'ll be in touch soon.');
        setFormData({ name: '', email: '', phone: '', message: '' });
      }
    } catch (error) {
      alert('Error submitting form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        placeholder="Your Name"
        required
      />
      <input
        name="email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        placeholder="Email"
        required
      />
      <input
        name="phone"
        value={formData.phone}
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
        placeholder="Phone"
      />
      <textarea
        name="message"
        value={formData.message}
        onChange={(e) => setFormData({...formData, message: e.target.value})}
        placeholder="Message"
        required
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Submit'}
      </button>
    </form>
  );
}
```

### WordPress (PHP)

```php
<form id="contact-form">
  <input name="name" placeholder="Your Name" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Phone">
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Submit</button>
</form>

<script>
jQuery('#contact-form').on('submit', async function(e) {
  e.preventDefault();
  const formData = {};
  jQuery(this).serializeArray().forEach(field => {
    formData[field.name] = field.value;
  });

  try {
    const response = await fetch('YOUR_WEBHOOK_URL_HERE', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      alert('Thank you! We\'ll be in touch soon.');
      this.reset();
    }
  } catch (error) {
    alert('Error submitting form. Please try again.');
  }
});
</script>
```

---

## 🧪 Testing

Use the included `test-workflow-form.html` file to test your workflow:

1. Open `test-workflow-form.html` in a browser
2. Enter your Workflow ID (found in AVA CRM)
3. Fill out the form
4. Submit and check AVA CRM for the new object/record

---

## 🔐 Security

- Each workflow has a unique ID
- CORS is configured to allow requests from any origin
- Workflows can only be accessed with the correct workflow ID
- All data is transmitted over HTTPS

---

## 📊 Data Structure

### Workflow Configuration (Firestore)

```javascript
{
  workflowId: "workflow_1234567890_xyz",
  name: "Contact Form Leads",
  status: "active",
  createdAt: Timestamp,
  createdBy: "user_uid",
  
  // Stored in subcollection: workflows/{id}/config/main
  mapping: {
    createObject: true,
    objectType: "Leads",
    objectId: "obj_abc123",
    recordTemplate: "Contact Form Lead",
    templateId: "template_xyz",
    sheetName: "New Leads",
    fieldMappings: [
      { formField: "name", crmField: "basicFields.fullName", required: true },
      { formField: "email", crmField: "basicFields.email", required: true },
      { formField: "phone", crmField: "basicFields.phoneNumber", required: false },
      { formField: "message", crmField: "templateFields.inquiryMessage", required: false }
    ]
  },
  notifications: {
    emailOnSubmission: true,
    emailsToNotify: ["sales@company.com"]
  },
  autoActions: {
    assignToUser: "user123",
    addToSheet: "New Leads Sheet"
  }
}
```

### Created Object Structure

```javascript
{
  docId: "object_1234567890_xyz",
  linkId: "object_1234567890_xyz",
  isObject: true,
  typeOfObject: "Leads",
  sheetName: "New Leads",
  
  // Mapped fields from form
  fullName: "John Doe",
  email: "john@example.com",
  phoneNumber: "+1 555-123-4567",
  
  createdAt: Timestamp,
  updatedAt: Timestamp,
  history: [...]
}
```

### Created Record Structure

```javascript
{
  docId: "record_1234567890_xyz",
  linkId: "object_1234567890_xyz", // Links to parent object
  typeOfRecord: "Contact Form Lead",
  typeOfRecords: "Contact Form Lead",
  sheetName: "New Leads",
  parentObjectId: "object_1234567890_xyz",
  parentObjectType: "Leads",
  
  // Mapped fields from form
  fullName: "John Doe",
  email: "john@example.com",
  phoneNumber: "+1 555-123-4567",
  inquiryMessage: "I'm interested in your services...",
  
  createdAt: Timestamp,
  updatedAt: Timestamp,
  history: [...]
}
```

---

## 🐛 Troubleshooting

### Form submission fails

**Check:**
1. Workflow ID is correct
2. Field mappings are configured in AVA CRM
3. Form field names match the mappings
4. Browser console for error messages

### Object/Record not created

**Check:**
1. Object type exists in templateObjects
2. Record template exists for the selected object
3. Required fields are mapped
4. Check Firebase Functions logs for errors

### Email notifications not working

**Check:**
1. Email addresses are valid
2. "Send email notifications" is enabled
3. Resend API key is configured

---

## 🔄 API Reference

### Endpoint

```
POST https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?wfId={workflowId}
```

### Request Headers

```
Content-Type: application/json
```

### Request Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1 555-123-4567",
  "message": "I'm interested in your services..."
}
```

**Note:** Field names should match the `formField` values in your workflow configuration.

### Response (Success)

```json
{
  "success": true,
  "message": "Form data processed successfully",
  "createdItems": [
    {
      "type": "object",
      "id": "object_1234567890_xyz"
    },
    {
      "type": "record",
      "id": "record_1234567890_xyz"
    }
  ]
}
```

### Response (Error)

```json
{
  "error": "Workflow not found"
}
```

---

## 🚀 Next Steps

1. **Create your first workflow** in AVA CRM
2. **Configure field mappings** for your use case
3. **Test with the included HTML file**
4. **Integrate into your website**
5. **Monitor submissions** in AVA CRM

---

## 💡 Use Cases

- **Contact Forms**: Capture leads from your website
- **Registration Forms**: Onboard new users or customers
- **Survey Forms**: Collect feedback and store in CRM
- **Quote Requests**: Auto-create opportunities from inquiries
- **Support Tickets**: Create support records from help forms
- **Newsletter Signups**: Manage subscribers in CRM
- **Event Registration**: Track event attendees

---

## 📞 Support

If you encounter any issues or have questions, please check:
- Firebase Functions logs in the Firebase Console
- Browser console for client-side errors
- Workflow configuration in AVA CRM

---

**Built with ❤️ for AVA CRM**
