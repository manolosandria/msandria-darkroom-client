Feature: Comments on photos
  As a visitor of the gallery
  I want to read and leave comments under a photo, signed with a name I choose
  So that I can talk about the photographs without the page filling with spam

  Background:
    Given the API is reachable
    And the photo "Virgencita" is open in the viewer with its info panel showing

  Scenario: A visitor reads the approved comments
    Given "Virgencita" has an approved comment by "Luis M."
    When the comments load
    Then the comment shows its author, date and text
    And the visitor is invited to sign in to leave a comment

  Scenario: A comment from a deleted account keeps its text
    Given an approved comment whose author deleted their account
    When the comments load
    Then it is shown as written by "Deleted user"

  Scenario: A signed-in visitor posts a comment that waits for moderation
    Given a signed-in visitor whose public name is "Ana G."
    When they write "Lovely" and press Enter
    Then the box is emptied and the comment waits a few seconds before it is sent
    And the waiting card says a moderator will review it before it appears
    When the wait is over
    Then the comment appears under the others marked "Awaiting moderation"
    And they are told it will appear once it is approved

  Scenario: Shift+Enter breaks the line
    Given a signed-in visitor writing a comment
    When they press Shift+Enter
    Then the box gets a new line and nothing is sent

  Scenario: A comment can be taken back before it is sent
    Given a signed-in visitor has just pressed Enter on a comment
    When they choose "Cancel and edit" before it is sent
    Then nothing is sent and the text returns to the box to be corrected or cleared

  Scenario: A comment can be sent without waiting
    Given a signed-in visitor has just pressed Enter on a comment
    When they choose "Send now"
    Then the comment is sent at once

  Scenario: A draft is kept while moving between photos
    Given a signed-in visitor has typed a comment without sending it
    When they move to another photo and come back
    Then their text is still in the box

  Scenario: An author cancels a comment awaiting moderation
    Given a signed-in visitor sees one of their comments awaiting moderation
    When they choose "Cancel" on it
    Then it disappears from the panel

  Scenario: A comment waiting to go is sent when the panel closes
    Given a signed-in visitor has just pressed Enter on a comment
    When they close the panel or move to another photo before the wait is over
    Then the comment is sent anyway

  Scenario: A refused comment keeps its text
    Given a signed-in visitor writes a comment with a link
    When the API rejects it
    Then the panel explains that comments cannot include links
    And the text stays in the box

  Scenario: Posting too often asks the visitor to wait
    Given a signed-in visitor has reached the comment limit
    When their next comment is sent
    Then the panel says how many seconds to wait
    And the comment is not sent again on its own

  Scenario: A visitor without a public name is sent to their account
    Given a signed-in visitor whose account has no public name
    When the comments load
    Then the form is replaced by a link to choose a public name

  Scenario: An author deletes their own comment
    Given a signed-in visitor sees one of their comments
    When they delete it
    Then it disappears from the panel

  Scenario: Choosing how comments are signed
    Given a signed-in visitor on their account page
    Then they can sign as their first name and initial, their full name or an alias
    And only the forms their account can build are offered
    When they choose an alias and save it
    Then new comments are signed with the alias
    And comments already sent keep the name they were sent with

  Scenario: The administrator reviews pending comments
    Given the administrator opens "/moderate" from "/upload"
    And a comment is waiting for review
    When they approve it
    Then it leaves the queue and appears under its photo
    When they delete another
    Then it leaves the queue and is never shown

  Scenario: Moderation is not offered to other visitors
    Given a signed-in visitor who is not the administrator
    When they open "/moderate"
    Then they are told only the administrator can review comments
