Feature: Photo viewer
  As a visitor
  I want to open a photo large, in its frame, at the quality I choose
  So that I can look at it closely and share a link to it

  Scenario: Opening a photo from the gallery
    Given the gallery shows a photo
    When the visitor selects it
    Then the viewer opens at /photo/<id>
    And the photo is shown in its own frame colour, if it has one

  Scenario: Quality icons
    Given a photo is open
    Then each quality option shows the same small picture in pixel blocks
    And the blocks get finer from Data saver to Standard to Maximum

  Scenario: Default quality
    Given a visitor who never chose a quality
    When a photo opens
    Then it uses the largest rendition up to 1920 px wide

  Scenario Outline: Choosing a quality
    Given a photo with renditions of 640, 960, 1920 and 2560 px
    When the visitor picks "<quality>"
    Then the photo uses the rendition <width> px wide
    And the choice is remembered for the next photo and the next visit

    Examples:
      | quality    | width |
      | Data saver | 960   |
      | Standard   | 1920  |
      | Maximum    | 2560  |

  Scenario: Storage is unavailable
    Given the browser refuses to store the preference
    When the visitor picks a quality
    Then the photo changes and the choice lasts until the page closes

  Scenario: Moving between photos
    Given the visitor is viewing a photo that has neighbours
    When they click anywhere on the left or right edge of the window, press the arrow keys or swipe sideways
    Then the previous or next photo opens at its own URL
    And the return arrow or Escape goes back to the gallery

  Scenario: Following the order the photo was opened from
    Given the visitor opened a photo from a Gallery page, a collection or Home
    When they move to the previous or next photo
    Then the photos follow that page's order, one per work
    And a photo opened from anywhere else follows the archive's chronology

  Scenario: Typing a comment
    Given the visitor is typing in the comment box
    When they press the arrow keys or Escape
    Then the cursor moves in the text and the viewer stays on the photo

  Scenario: Title and controls over the photo
    Given a photo is open
    Then its title is shown over the photo with the arrows and the quality selector
    When the visitor left-clicks the photo
    Then the title and every control hide
    When the visitor moves the mouse
    Then they show again

  Scenario: Touch screens
    Given a photo is open on a touch screen
    When the visitor taps the photo
    Then the title and controls toggle between shown and hidden
    And a swipe changes the photo without toggling them

  Scenario: Opening the info panel
    Given a photo is open
    When the visitor presses the information button
    Then a white panel beside the photo, or below it on a phone, shows the title, then the description, then the details
    And the photo shrinks to fit beside it instead of being covered
    And the details list capture date, camera, lens, focal length, aperture, shutter speed and ISO when recorded
    When the visitor presses Escape
    Then the panel closes and the photo stays open

  Scenario: The info panel stays open between photos
    Given the info panel is open
    When the visitor moves to the next photo
    Then the panel stays where it is and shows the new photo's information

  Scenario: A first-time visitor learns that a click hides the controls
    Given a visitor opens a photo for the first time in this browser
    Then a short hint over the photo, without a background, says a click hides the controls
    And it fades away on its own, or as soon as they click the photo
    When they open another photo later
    Then the hint is not shown again

  Scenario: Choosing the corner of the title
    Given a photo whose title would be lost over a bright corner
    When the administrator picks "Top right" as its title corner in /manage and saves
    Then the viewer shows that photo's title in the top-right corner
    And photos without a choice keep it in the bottom-left corner

  Scenario: A photo without camera details
    Given a photo whose file had no EXIF
    When the visitor opens the info panel
    Then it says no camera details were recorded

  Scenario: A photo that does not exist
    Given a link to a photo the API does not know
    When the viewer opens
    Then "Photo not found" is shown with a retry action
