Feature: Photo entity
  As the photo gallery system
  I want Photo objects to always be in a valid state
  So that invalid data never reaches the UI

  Scenario: Creating a photo with valid data
    Given an id "esferabalero", a title "Esfera" and a url "https://cdn/esfera.jpg"
    When a Photo is created with that data
    Then the photo title is "Esfera"
    And the photo url is "https://cdn/esfera.jpg"

  Scenario: Title and url are trimmed on creation
    Given a title "  Esfera  " and a url "  https://cdn/esfera.jpg  "
    When a Photo is created with that data
    Then the photo title is "Esfera"
    And the photo url is "https://cdn/esfera.jpg"

  Scenario Outline: Rejecting a photo with missing required fields
    Given an id "<id>", a title "<title>" and a url "<url>"
    When a Photo is created with that data
    Then creation fails with an error

    Examples:
      | id   | title  | url            |
      |      | Esfera | https://cdn/x  |
      | id-1 |        | https://cdn/x  |
      | id-1 | Esfera |                |

  Scenario: Renaming an existing photo
    Given a valid photo titled "Esfera"
    When it is renamed to "Nuevo nombre"
    Then the photo title is "Nuevo nombre"

  Scenario: Renaming a photo to an empty title is rejected
    Given a valid photo titled "Esfera"
    When it is renamed to "   "
    Then the rename fails with an error
    And the photo title is still "Esfera"
