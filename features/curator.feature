Feature: Curator workspace
  Scenario: One place for the administrator
    Given I am signed in as the administrator
    Then the header offers "Curator" instead of "Upload"
    And it shows how many comments await moderation and how many messages are unread
    When I open Curator
    Then I can switch between Upload, Photos, Collections, Moderation and Inbox
    And a section I visited keeps its unsaved state while I look at another

  Scenario: Upload one or all
    Given I added several photos to the upload workshop
    Then each card has its own Upload button at its bottom right
    And "Upload All (n)" appears above and below the cards
    When I upload one card
    Then only that photo is published

  Scenario: Classify while uploading or editing
    Given a photo card or a published photo in Photos
    Then it starts as public unless I choose private, select or collections only
    When I type a category, existing ones are suggested
    And a comma closes the category as a chip
    When I add the photo to collections
    Then I choose its position in each one

  Scenario: Compose a collection
    Given collections appear as cards with their title and cover photo
    When I open one and untick photos
    Then they are marked to be removed but stay in place
    And nothing changes until I save the whole collection at once

  Scenario: Private photos stay private
    Given a photo is private
    Then the public gallery never lists it
    And its images reach me through the API, never as a public image URL
