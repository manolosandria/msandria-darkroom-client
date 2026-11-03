Feature: Variants studio, attention alerts and the variants' corner
  The curator groups files as one work, prepares every new file before it uploads, and
  sees at once which photographs still need attention.

  Scenario: Preparing files before they join a work
    Given the curator opens Curator → Variants
    When they drop two image files on the plus at the end of the work
    Then each file waits as a card with its title, description, visibility, categories, collections and highlights
    And each card starts from the visibility of the work's main photo
    When they press "Upload all (2)"
    Then both files upload at the same time, up to three at once
    And every uploaded file joins the work's draft

  Scenario: Cancelling an upload on its way
    Given two files are uploading into a work
    When the curator presses "Cancel all"
    Then both requests stop and their cards say "Cancelled"
    And each card keeps its edits and offers "Try again"
    And "Save variants" waits until no upload is running

  Scenario: Ordering the variants and choosing the main one
    Given a work with the photographs "Color" and "Monochrome", in that order
    When the curator presses the star of "Monochrome"
    Then "Monochrome" becomes the first and main variant
    When the curator moves it one place with the right arrow key
    Then "Color" is the main variant again
    And "Save variants" saves the photographs in the order shown

  Scenario: Browsing the library three ways
    Given the Variants library
    Then it can be searched by title and narrowed by category
    And it shows as a grid, a list with visibility and work, or a filmstrip

  Scenario: Curator folded into one pill
    Given the curator hides Curator's tabs
    Then one floating pill names the open group and tab
    And pointing at it, tabbing into it or pressing it opens every group under it
    And the backdrop swatches stay beside it with a button to show the tabs again

  Scenario: Photos that need attention
    Given one photograph whose file has its GPS location pending and another without a portrait highlight
    When the curator opens Curator → Photos
    Then "Needs optimization" turns amber with the count 2
    And a line names "missing highlights (1)" and "gps location (1)" with "Review them"
    When the curator reviews them and unticks "Missing highlights"
    Then only the photograph with the pending GPS location stays listed

  Scenario: The variants never cover the title in the viewer
    Given a photograph whose title sits in the top left corner
    Then its variant thumbnails go to the top right corner automatically
    When the curator chooses the bottom right corner for them in Photos
    Then the viewer shows them there
    And the title's corner cannot be chosen for them
    When the curator moves the title to the bottom right corner
    Then the variants go back to Automatic

  Scenario: Highlights in the info panel
    Given a photograph with a square highlight and one named "Sky"
    When a visitor opens its info panel
    Then the panel lists both highlights, each in its own shape
    And choosing "Sky" shows it large under the row
