import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          signIn: {
            signin: "Sign In",
            shortText: "Log in to access your account.",
            email: "Email",
            password: "Password",
            forgotPassword: "Forgot Password?",
            dontHaveAccount: "Don't have an account?",
            signup: "Sign Up",
            userNotFound: "No account found with this email.",
            wrongPassword: "Incorrect password. Please try again.",
            invalidEmail: "Invalid email format.",
            tooManyRequests: "Too many attempts. Please try again later.",
            genericError: "An error occurred. Please try again."
          },
          forgotPassword: {
            title: "Reset Password",
            emailSentTitle: "Check Your Email",
            instructions: "Enter your email address to receive a password reset link.",
            emailSentInstructions: "We've sent a password reset link to your email. Please check your inbox (and spam folder).",
            label: "Email",
            sendEmailButton: "Send Reset Link",
            gotItButton: "Got It",
            closeModal: "Close modal",
            closeButton: "Close",
            emailError: "Please enter a valid email address.",
            userNotFound: "No account found with this email.",
            invalidEmail: "Invalid email format.",
            tooManyRequests: "Too many requests. Please try again later.",
            genericError: "An error occurred. Please try again."
          },
          businessSignUp: {
            signup: "Sign Up",
            shortText: "Create your business account to get started.",
            businessName: "Business Name",
            email: "Email",
            password: "Password",
            invitationCode: "Invitation Code",
            createAccount: "Create Account",
            alreadyHaveAccount: "Already have an account?",
            signin: "Sign In",
            successMessage: "Account created successfully! Redirecting...",
            passwordRequirement: {
              minLength: "Password must be at least 8 characters",
              uppercase: "Password must contain an uppercase letter",
              lowercase: "Password must contain a lowercase letter",
              number: "Password must contain a number"
            },
            error: {
              emailInUse: "This email is already in use.",
              invalidEmail: "Invalid email format.",
              weakPassword: "Password is too weak.",
              invalidCode: "Invalid invitation code.",
              generic: "Failed to create account. Please try again."
            }
          },
          settings: {
            title: "Settings",
            teamInvitations: "Team Invitations",
            sendInvitation: "Send Email Invitation",
            viewPendingInvitations: "View Pending Invitations",
            recipientEmail: "Recipient Email",
            enterEmail: "Enter recipient's email",
            sending: "Sending...",
            pleaseLogin: "Please log in to send invitations",
            enterValidEmail: "Please enter a valid email address",
            invitationAlreadyExists: "An invitation for this email already exists",
            noBusinessId: "Business ID not found",
            errorSendingInvitation: "Failed to send invitation: {message}",
            manageTeamAccess: "Manage Team Access",
            editAccessFor: "Edit Access for {email}",
            unknownEmail: "Unknown Email",
            noTeamMembersSelected: "Please select at least one team member",
            selectOption: "Select an option to proceed",
            noPendingInvitations: "No pending invitations",
            invitedOn: "Invited on {date}",
            deleteInvitation: "Delete invitation for {email}",
            deleteTeamMember: "Delete team member {email}",
            none: "None",
            viewer: "Viewer",
            editor: "Editor",
            dashboard: "Dashboard",
            metrics: "Metrics",
            sheets: "Sheets",
            actions: "Actions",
            financials: "Financials",
            selectSheets: "Select Sheets",
            selectSheet: "Select sheet {name}",
            noSheetsAvailable: "No sheets available",
            noSheetsSelected: "Please select at least one sheet",
            save: "Save",
            cancel: "Cancel",
            back: "Back",
            accessUpdated: "Access updated successfully",
            teamMemberNotFound: "Team member data not found",
            errorFetchingData: "Failed to load team members or resources: {message}",
            errorUpdatingAccess: "Failed to update access: {message}",
            noAuthenticatedUser: "No authenticated user found",
            userDataNotFound: "User data not found",
            failedToSendInvitation: "Failed to send invitation",
            cannotDeleteSelf: "You cannot delete yourself",
            confirmDeleteTeamMember: "Are you sure you want to delete {email}?",
            teamMemberDeleted: "Team member deleted successfully",
            errorDeletingInvitation: "Failed to delete invitation: {message}",
            errorDeletingTeamMember: "Failed to delete team member: {message}",
            invitationDeleted: "Invitation deleted successfully"
          },
          teamMemberSignUp: {
            signup: "Sign Up",
            shortText: "Join {businessName} as a team member.",
            shortTextGeneric: "Join a team to get started.",
            email: "Email",
            password: "Password",
            phone: "Phone Number",
            invitationCode: "Invitation Code",
            createAccount: "Create Account",
            alreadyHaveAccount: "Already have an account?",
            signin: "Sign In",
            name: "Name",
            surname: "Surname",
            successMessage: "Account created successfully! Redirecting...",
            passwordRequirement: {
              minLength: "Password must be at least 8 characters",
              uppercase: "Password must contain an uppercase letter",
              lowercase: "Password must contain a lowercase letter",
              number: "Password must contain a number"
            },
            error: {
              invalidEmail: "Invalid email format.",
              invalidPhone: "Invalid phone number format. Use + followed by country code and number.",
              invalidCode: "Invalid or missing invitation code.",
              emailInUse: "This email is already in use.",
              weakPassword: "Password is too weak.",
              notFound: "Invitation code not found.",
              failedPrecondition: "Invitation code is invalid or expired.",
              generic: "Failed to create account. Please try again."
            }
          }
        }
      }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React handles XSS
    }
  });

export default i18n;