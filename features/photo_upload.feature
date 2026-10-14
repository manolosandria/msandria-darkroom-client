Feature: Publishing a photo through the API
  As the administrator of the gallery
  I want to publish a photo from the site
  So that the catalogue grows without touching the database or the image host by hand

  Background:
    Given the API is reachable
    And the header holds the session the whole page shares

  Scenario: The upload page is offered to the administrator only
    Given a signed-in administrator
    When the header loads
    Then the "Upload" link is offered

  # Hiding the link is tidiness, not a safeguard: the API settles permissions on every
  # request by reading the role from its own database.
  Scenario: A registered visitor is not offered the upload page
    Given a signed-in registered visitor
    When the header loads
    Then the "Upload" link is not offered

  Scenario: A visitor without a session is not offered the upload page
    Given nobody is signed in
    When the header loads
    Then the "Upload" link is not offered

  Scenario: A visitor without a session is sent to the header to sign in
    Given nobody is signed in
    When the upload page loads
    Then the form is not shown
    And the page points at the sign-in button in the header

  Scenario: A registered visitor is told who may publish
    Given a signed-in registered visitor
    When the upload page loads
    Then the form is not shown
    And the page says only the administrator can publish

  Scenario: Publishing a photo
    Given a signed-in administrator
    And a chosen file and a title
    When the photo is published
    Then the file and the title are sent to the API as multipart form data
    And the session cookie travels with them
    And the published photo is shown with its title
    And the form is emptied for the next photo

  # The stored file is never the one that was handed in: the API resizes it, converts
  # it to sRGB and strips every tag, the GPS location included.
  Scenario: The file is sent exactly as it came off the disk
    Given a signed-in administrator
    And a chosen file and a title
    When the photo is published
    Then the file is sent unchanged
    And Content-Type is left for the browser to write

  Scenario: What the file was missing is reported on publishing
    Given a signed-in administrator
    And the API answers with an issue it fixed and an issue that needs a new export
    When the photo is published
    Then the issue that needs a new export is listed as worth exporting again
    And the issue the API fixed is listed as corrected while uploading

  Scenario: A photo exported exactly as the gallery wants it
    Given a signed-in administrator
    And the API answers with no issues at all
    When the photo is published
    Then the page says there is nothing to fix

  Scenario: Submitting without choosing a file
    Given a signed-in administrator
    And a title but no chosen file
    When the photo is published
    Then the API is not called
    And the page asks for a file

  Scenario: A photo the API rejected
    Given a signed-in administrator
    And the API rejects the photo and says why
    When the photo is published
    Then the reason is reported
    And the form keeps what was typed

  Scenario: A file the API considers too large
    Given a signed-in administrator
    And the API answers that the file is over its size limit
    When the photo is published
    Then the page says to export it smaller

  Scenario: A session that ended while the page was open
    Given a signed-in administrator
    And the API answers that there is no live session
    When the photo is published
    Then the page says to sign in again

  Scenario: The button cannot be pressed twice
    Given a signed-in administrator
    When the photo is published and the API has not answered yet
    Then the publish button is disabled
