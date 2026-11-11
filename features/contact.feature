Feature: Contact
  Scenario: Browser language differs from the site
    Given my browser uses a different language
    When required fields or the email format are invalid
    Then the form shows its own English validation message
    And no message is submitted

  Scenario: Send a message while signed in
    Given I am signed in
    When I open Contact
    Then the email field shows my account's address and cannot be changed
    When I write my name and message and agree to how my details are used
    Then I am told my message reached the photographer's inbox at once

  Scenario: Send a message without signing in
    Given nobody is signed in
    When I write my name, email and message and agree to how my details are used
    Then the page asks for the 6-digit code emailed to that address
    And it asks every time, even for an address confirmed before
    When I type the code
    Then I am told my message reached the photographer's inbox

  Scenario: A wrong code
    Given my message waits for its code
    When I type a wrong or expired code
    Then I see why and can try again or go back to edit the message

  Scenario: Nothing is lost on a refusal
    When the message is refused or too many were sent
    Then I see why
    And my message is still in the form

  Scenario: The administrator reads the inbox
    Given I am signed in as the administrator
    When I open Inbox in Curator
    Then I see each message with its sender, email and date, unread ones marked
    And I can mark a message as read or delete it, which updates the header count

  Scenario: The administrator blocks a sender
    Given I am signed in as the administrator
    When I block the sender of a message after confirming
    Then the message is marked as from a blocked sender
    And the sender appears under Blocked senders, where I can unblock them
