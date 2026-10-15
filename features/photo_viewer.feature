Feature: Photo viewer
  As a visitor
  I want to open a photo large, in its frame, at the quality I choose
  So that I can look at it closely and share a link to it

  Scenario: Opening a photo from the gallery
    Given the gallery shows a photo
    When the visitor selects it
    Then the viewer opens at /photo/<id>
    And the photo is shown in its own frame colour, if it has one

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
    When they press the arrow keys or swipe sideways
    Then the previous or next photo opens at its own URL
    And Escape returns to the gallery

  Scenario: A photo that does not exist
    Given a link to a photo the API does not know
    When the viewer opens
    Then "Photo not found" is shown with a retry action
