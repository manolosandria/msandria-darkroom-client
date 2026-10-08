Feature: Photo entity
  As the photo gallery system
  I want Photo objects to always be in a valid state
  So that invalid data never reaches the UI

  Scenario: Creating a photo with valid data
    Given an id "esferabalero", a title "Esfera" and renditions of 640 and 1280 px
    When a Photo is created with that data
    Then the photo title is "Esfera"
    And the photo keeps both renditions, narrowest first

  Scenario: Title and rendition urls are trimmed on creation
    Given a title "  Esfera  " and a rendition url "  https://cdn/esfera.jpg  "
    When a Photo is created with that data
    Then the photo title is "Esfera"
    And the rendition url is "https://cdn/esfera.jpg"

  Scenario Outline: Rejecting a photo with missing required fields
    Given a photo with <problem>
    When a Photo is created with that data
    Then creation fails with an error

    Examples:
      | problem                   |
      | no id                     |
      | no title                  |
      | no renditions             |
      | a rendition without url   |
      | a rendition without width |

  Scenario: Choosing the rendition for a display width
    Given a photo with renditions of 640 and 1280 px
    When the gallery needs 600, 640, 641 or 3840 px
    Then it gets the 640, 640, 1280 and 1280 px renditions respectively

  Scenario: Renaming an existing photo
    Given a valid photo titled "Esfera"
    When it is renamed to "Nuevo nombre"
    Then the photo title is "Nuevo nombre"

  Scenario: Renaming a photo to an empty title is rejected
    Given a valid photo titled "Esfera"
    When it is renamed to "   "
    Then the rename fails with an error
    And the photo title is still "Esfera"
