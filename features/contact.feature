Feature: Contact
  Scenario: Browser language differs from the site
    Given my browser uses a different language
    When required fields or the email format are invalid
    Then the form shows its own English validation message
    And no message is submitted

  Scenario: Send a message to the photographer
    Given I open Contact from the header
    When I write my name, email and message and agree to how my details are used
    Then I am told my message reached the photographer's inbox
    And no email is sent automatically

  Scenario: Nothing is lost on a refusal
    When the message is refused or too many were sent in a minute
    Then I see why
    And my message is still in the form

  Scenario: The administrator reads the inbox
    Given I am signed in as the administrator
    When I open Inbox in Curator
    Then I see each message with its sender, email and date, unread ones marked
    And I can mark a message as read or delete it, which updates the header count
