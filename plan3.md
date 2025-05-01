# AniMatch App Development Plan

## Step 1: Invitation Feature Implementation

- **UI for Sending Invitations**
  - Add a new section in the app where users can input an email to send an invitation.
  - Include validation to ensure the email format is correct before submission.

- **Backend Logic for Handling Invitations**
  - Create an API endpoint to handle invitation requests.
  - Check if the email belongs to an existing user:
    - If yes, send an in-app notification or message.
    - If no, send an email invitation with a registration link.

## Step 2: Registration and Quiz Access for Invitees

- **Registration Process for New Users**
  - Ensure the registration link in the invitation email directs users to the signup page.
  - After registration, guide users to the quiz section.

## Step 3: Relationship Type Selection

- **UI for Relationship Type Selection**
  - Prompt the invitee to select the relationship type (Lover, Business Partner, Family) immediately after registration and before starting the quiz.
  - Store this information to tailor the compatibility insights.

## Step 4: Quiz Access and Completion

- **Quiz Access and Completion**
  - Allow invitees to take the quiz once they have registered, selected the relationship type, and logged in.
  - Ensure the quiz flow is the same as for existing users.

## Step 5: Compatibility Calculation and Display

- **Compatibility Score Calculation**
  - After both users complete the quiz, calculate the compatibility score.
  - Use the `animal_compatibility` table to store the results.

- **Display Compatibility Results**
  - Create a UI component to display compatibility results to both users.
  - Include insights from the `compatibility_insight_templates` table based on the score and relationship type.