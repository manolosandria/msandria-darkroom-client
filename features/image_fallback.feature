Feature: Fall back to the other image host

  Public photos may be stored on two image hosts. The API names the one to use and,
  when the photo has a copy on the other, the same rendition there as a fallback.

  Scenario: A gallery image fails to load
    Given a public photo with renditions on both image hosts
    When its image fails to load in the gallery
    Then every rendition of that image is requested from the other host instead

  Scenario: The viewer image fails to load
    Given a public photo with renditions on both image hosts
    When the photo fails to load in the viewer
    Then the same width is requested from the other host

  Scenario: There is no second retry
    Given an image that already switched to the other host
    When it fails to load again
    Then it stays as it is instead of retrying in a loop

  Scenario: A photo stored on one host only
    Given a photo whose renditions have no fallback
    When its image fails to load
    Then nothing else is requested
