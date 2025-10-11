# Workflow Integration Examples

This document provides real-world examples of how to use the AVA CRM Workflow Integration System.

---

## Example 1: Simple Contact Form

### Scenario
A business wants to capture leads from their "Contact Us" page.

### AVA CRM Configuration

**Workflow Name:** Contact Form Leads

**Object Type:** Leads

**Record Template:** Contact Inquiry

**Field Mappings:**
- `name` → `Full Name (Object Field)`
- `email` → `Email Address (Object Field)`
- `phone` → `Phone Number (Object Field)`
- `company` → `Company Name (Object Field)`
- `message` → `Inquiry Details (Template Field)`

**Notifications:** sales@company.com

### Website Integration

```html
<form id="contactForm">
  <input name="name" placeholder="Your Name" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Phone">
  <input name="company" placeholder="Company">
  <textarea name="message" placeholder="How can we help?" required></textarea>
  <button type="submit">Send Message</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  
  const response = await fetch('https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?wfId=workflow_1728665432_abc123', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    alert('Thank you! We\'ll be in touch soon.');
    e.target.reset();
  }
});
</script>
```

### Result
- A new "Leads" object is created
- A "Contact Inquiry" record is created and linked to the lead
- Sales team receives an email notification

---

## Example 2: Event Registration

### Scenario
A company hosting a webinar wants to track registrations in their CRM.

### AVA CRM Configuration

**Workflow Name:** Webinar Registration

**Object Type:** Contacts

**Record Template:** Event Registration

**Field Mappings:**
- `firstName` → `First Name (Object Field)`
- `lastName` → `Last Name (Object Field)`
- `email` → `Email (Object Field)`
- `jobTitle` → `Job Title (Object Field)`
- `eventName` → `Event Name (Template Field)`
- `registrationDate` → `Registration Date (Template Field)`

### Website Integration

```html
<form id="registrationForm">
  <h2>Webinar Registration</h2>
  <input type="hidden" name="eventName" value="Q4 Product Launch Webinar">
  <input type="hidden" name="registrationDate" value="">
  
  <input name="firstName" placeholder="First Name" required>
  <input name="lastName" placeholder="Last Name" required>
  <input name="email" type="email" placeholder="Work Email" required>
  <input name="jobTitle" placeholder="Job Title">
  
  <button type="submit">Register Now</button>
</form>

<script>
document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Set registration date
  e.target.registrationDate.value = new Date().toISOString();
  
  const data = Object.fromEntries(new FormData(e.target));
  
  const response = await fetch('https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?wfId=workflow_1728665500_xyz456', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    window.location.href = '/thank-you';
  }
});
</script>
```

---

## Example 3: Multi-Step Form

### Scenario
A SaaS company with a multi-step signup form.

### AVA CRM Configuration

**Workflow Name:** SaaS Trial Signup

**Object Type:** Accounts

**Record Template:** Trial Account

**Field Mappings:**
- `companyName` → `Company Name (Object Field)`
- `website` → `Website (Object Field)`
- `industry` → `Industry (Object Field)`
- `contactName` → `Primary Contact (Object Field)`
- `contactEmail` → `Email (Object Field)`
- `planType` → `Plan Type (Template Field)`
- `teamSize` → `Team Size (Template Field)`

### Website Integration (React)

```jsx
import { useState } from 'react';

export default function SignupWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    planType: 'starter',
    teamSize: '1-10'
  });

  const handleSubmit = async () => {
    try {
      const response = await fetch(
        'https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?wfId=workflow_1728665600_def789',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      );

      if (response.ok) {
        // Redirect to dashboard or thank you page
        window.location.href = '/welcome';
      }
    } catch (error) {
      alert('Error creating account. Please try again.');
    }
  };

  return (
    <div>
      {step === 1 && (
        <div>
          <h2>Company Information</h2>
          <input
            value={formData.companyName}
            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
            placeholder="Company Name"
          />
          <input
            value={formData.website}
            onChange={(e) => setFormData({...formData, website: e.target.value})}
            placeholder="Website"
          />
          <select
            value={formData.industry}
            onChange={(e) => setFormData({...formData, industry: e.target.value})}
          >
            <option value="">Select Industry</option>
            <option value="technology">Technology</option>
            <option value="healthcare">Healthcare</option>
            <option value="finance">Finance</option>
          </select>
          <button onClick={() => setStep(2)}>Next</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Contact Information</h2>
          <input
            value={formData.contactName}
            onChange={(e) => setFormData({...formData, contactName: e.target.value})}
            placeholder="Your Name"
          />
          <input
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
            placeholder="Work Email"
          />
          <button onClick={() => setStep(1)}>Back</button>
          <button onClick={() => setStep(3)}>Next</button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Plan Selection</h2>
          <select
            value={formData.planType}
            onChange={(e) => setFormData({...formData, planType: e.target.value})}
          >
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={formData.teamSize}
            onChange={(e) => setFormData({...formData, teamSize: e.target.value})}
          >
            <option value="1-10">1-10 users</option>
            <option value="11-50">11-50 users</option>
            <option value="51+">51+ users</option>
          </select>
          <button onClick={() => setStep(2)}>Back</button>
          <button onClick={handleSubmit}>Create Account</button>
        </div>
      )}
    </div>
  );
}
```

---

## Example 4: API Integration (Node.js Backend)

### Scenario
A mobile app backend needs to create leads in AVA CRM.

### Server-Side Integration (Express.js)

```javascript
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const AVA_WEBHOOK_URL = 'https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?wfId=workflow_1728665700_ghi012';

app.post('/api/submit-lead', async (req, res) => {
  try {
    const { name, email, phone, source } = req.body;

    // Validate data
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Submit to AVA CRM
    const response = await fetch(AVA_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        source: source || 'mobile-app'
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      res.json({ success: true, message: 'Lead created successfully' });
    } else {
      res.status(500).json({ error: 'Failed to create lead in CRM' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Example 5: WordPress Plugin Integration

### Scenario
Using AVA CRM with Contact Form 7 in WordPress.

### WordPress Functions (functions.php)

```php
<?php
// Hook into Contact Form 7 submission
add_action('wpcf7_before_send_mail', 'send_to_ava_crm');

function send_to_ava_crm($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    
    if ($submission) {
        $posted_data = $submission->get_posted_data();
        
        // Map Contact Form 7 fields to AVA CRM
        $ava_data = array(
            'name' => $posted_data['your-name'],
            'email' => $posted_data['your-email'],
            'phone' => $posted_data['your-phone'],
            'message' => $posted_data['your-message']
        );
        
        // Send to AVA CRM
        $workflow_id = 'workflow_1728665800_jkl345';
        $url = 'https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?wfId=' . $workflow_id;
        
        $response = wp_remote_post($url, array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode($ava_data),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            error_log('AVA CRM integration error: ' . $response->get_error_message());
        }
    }
}
?>
```

---

## Tips & Best Practices

### 1. Field Naming Consistency
Keep form field names consistent across your website:
- Use lowercase
- Use hyphens or underscores
- Be descriptive: `email` instead of `e` or `mail`

### 2. Error Handling
Always implement proper error handling:
```javascript
try {
  const response = await fetch(webhookUrl, {...});
  if (!response.ok) {
    const error = await response.json();
    console.error('AVA CRM error:', error);
    // Show user-friendly message
  }
} catch (error) {
  console.error('Network error:', error);
  // Show user-friendly message
}
```

### 3. Loading States
Show users feedback while submitting:
```javascript
submitBtn.disabled = true;
submitBtn.textContent = 'Sending...';
// ... submit form ...
submitBtn.disabled = false;
submitBtn.textContent = 'Submit';
```

### 4. Hidden Fields
Use hidden fields for metadata:
```html
<input type="hidden" name="source" value="website">
<input type="hidden" name="campaign" value="spring-2024">
<input type="hidden" name="referrer" id="referrer">
<script>
  document.getElementById('referrer').value = document.referrer;
</script>
```

### 5. Validation
Validate data before sending:
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(formData.email)) {
  alert('Please enter a valid email address');
  return;
}
```

---

## Common Patterns

### Success Redirect
```javascript
if (response.ok) {
  window.location.href = '/thank-you?email=' + encodeURIComponent(formData.email);
}
```

### GTM/Analytics Tracking
```javascript
if (response.ok) {
  // Track conversion in Google Tag Manager
  dataLayer.push({
    'event': 'form_submission',
    'form_name': 'contact_form',
    'form_type': 'lead_gen'
  });
}
```

### Progressive Enhancement
```javascript
// Fallback to standard form submission if fetch fails
const form = document.getElementById('contactForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    await submitToAvaCRM(formData);
  } catch (error) {
    // Fallback: submit form normally
    form.submit();
  }
});
```

---

Ready to integrate? Head over to the [Workflow Integration Guide](./WORKFLOW_INTEGRATION_GUIDE.md) for complete setup instructions!
