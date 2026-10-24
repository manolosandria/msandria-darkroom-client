Feature: Home banner studio
  Scenario: Preview and publish the welcome
    Given an administrator opens Home in Curator
    When they edit the words, palette, font, shape and placement
    Then the live preview reflects the draft
    And saving applies the design to the public Home

  Scenario: Preserve an unsuccessful edit
    Given the administrator has changed the banner
    When saving fails or another session has changed the version
    Then the draft is preserved with an error and an explicit reload action
    And leaving with unsaved changes asks whether to save or discard

  Scenario: Arrange the welcome without a placement dropdown
    Given the administrator is editing Home
    When they drag Welcome or Photographs to an edge of the composition board
    Then the preview uses the corresponding layout
    And the same action is available with destination buttons and arrow keys

  Scenario: Fill a mobile banner and swipe
    Given Home uses the highlight presentation
    Then the mobile highlight covers the banner or falls back to the full photo
    And the preview and carousel controls fit a 320 pixel viewport
    When a visitor swipes horizontally across the photo
    Then the carousel changes slide without opening the photo
    And vertical gestures still scroll the page

  Scenario: Choose an exact highlight from a preview photo
    Given an administrator previews the Home banner
    When they click a photograph
    Then its banner settings open without navigating away
    And saved highlights can be filtered by ratio and selected per device
    And the preview reports downloaded and effective crop resolution

  Scenario: Edit highlights directly in Home
    Given an administrator opens a photograph in the Home preview
    When they edit and save its highlights
    Then the photograph is saved with its current version
    And failures preserve the draft with an explicit reload option
    And device icon choices keep the preview and photo settings synchronized

  Scenario: Browse the preview with a mouse or keyboard
    Given the carousel has keyboard focus
    When the administrator presses a horizontal arrow or drags across a photograph
    Then the current slide changes
    And composition drag targets accept move operations without a forbidden cursor

  Scenario: Publish slide destinations and overlay presentation
    Given an administrator selects a banner photograph
    When they choose its caption and a photo, gallery, category, collection or HTTPS destination
    And choose overlay welcome and carousel navigation
    Then saving applies the caption, link and presentation to public Home
    And the active welcome placement remains marked without moving buttons
