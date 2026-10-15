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

  Scenario: Select a rendition using its real pixel width
    Given the API supplies signed renditions with their actual widths
    When the gallery renders a photo
    Then its native srcset contains exactly those URLs and width descriptors
    And no Next image loader translates widths or generates additional variants
    And auto sizes uses the laid-out photo width with a bounded responsive fallback
    And images are loaded lazily near the viewport

  Scenario: Reuse cached renditions across gallery pages
    Given a rendition is cached by the browser and its URL has not changed
    When I return to a page using that rendition
    Then the browser can reuse it without transferring its image bytes again
    But a larger display size may require downloading a larger rendition once
