Feature: Gallery grid in justified rows
  As a visitor
  I want the gallery to show every photo in its own proportion
  So that the work is seen as it was framed, not cropped into squares

  Scenario: Photos keep their proportion
    Given a landscape photo of 3000x2000 and a portrait photo of 2000x3000
    When the gallery shows them
    Then each tile has the proportion of its photo, 3:2 and 2:3

  Scenario: Every row fills the page width at a single height
    Given a page wide enough for several photos per row
    When the gallery lays out the photos
    Then all the photos in a row have the same height
    And together with the gaps they span the full width of the gallery

  Scenario: The last row is not stretched
    Given the last row has room for more photos
    When the gallery lays out the photos
    Then the photos in the last row keep the base row height

  Scenario: The layout follows the page size
    Given the window gets wider
    When the gallery lays out the photos again
    Then the rows get taller and wider, without any horizontal scroll

  Scenario: One photo per row on phones
    Given a window narrower than 640 px
    When the gallery lays out the photos
    Then each photo takes the full width in its own proportion

  Scenario: Only the renditions sent by the API are loaded
    When the gallery shows a photo
    Then every candidate in its src and srcset is one of the photo's renditions
    And only the first 4 photos load right away; the rest load as they come into view
