Feature: An upload workspace with manual thumbnail crops
  As the administrator of the gallery
  I want to prepare several photographs at once and choose how each one is cropped
  So that a batch goes up in one sitting and every thumbnail shows what matters

  Background:
    Given a signed-in administrator
    And the API is reachable

  Scenario: Publish multiple photographs sequentially
    Given the administrator selects several photographs
    When they edit each title and description and publish the queue
    Then only one upload request is in flight at a time
    And each photograph keeps its own optimization report

  Scenario: Retry a rejected photograph
    Given one photograph fails while another publishes successfully
    When the administrator publishes again
    Then only the failed photograph is retried with its edits preserved

  Scenario: Select optional thumbnail crops
    Given a photograph is selected for upload
    When the administrator adds a square, landscape or portrait highlight
    Then they can move and resize it inside the oriented photograph
    And a thumbnail preview shows the selected region
    And any or all highlights may be omitted or removed

  Scenario: Edit published highlights
    Given the administrator opens a published photograph in the management screen
    When they save its title, description and highlights
    Then the existing photograph is updated without another file upload

  Scenario: Edit a photo from a compact listing
    Given the listing does not include descriptions
    When the administrator selects a photo to edit
    Then its detail is loaded before opening the editor
    And saving preserves the description returned by the detail
    But a failed detail request offers retry without opening an incomplete editor

  Scenario: Work on one size of highlight at a time
    Given the highlight editor of a photograph
    Then Original, Square, Landscape, Portrait and Free are tabs, each counting its highlights
    When the administrator chooses a tab
    Then only that size's highlights and where its chosen view can appear are shown
    And the Photos stage shows the chosen highlight large

  Scenario: Keep the sizes in view while drawing
    Given the administrator presses + in the Square tab
    Then every size stays on offer and Square is marked
    When they choose Landscape before accepting
    Then the drawing becomes a landscape where it was

  Scenario: Several highlights of one size
    Given a photograph with a main square
    When the administrator draws another square
    Then it is kept as "Square 2", a named square beside the main one
    And it can be renamed, moved, resized, duplicated or removed
    And "Make main" swaps it with the main square, whose Gallery and Home choices follow it

  Scenario: Shaped highlights join the grids
    When the administrator accepts a square, landscape or portrait highlight
    Then Gallery's Grid and Random offer it in its own proportion
    And Original keeps showing the photograph as it is
