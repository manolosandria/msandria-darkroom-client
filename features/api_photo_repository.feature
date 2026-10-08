Feature: API photo repository
  As the application
  I want the API repository to map the API's photos into domain Photo objects
  So that the gallery shows the catalogue stored in msandria-darkroom-api

  Scenario: Listing all photos
    Given the API lists 2 photos, newest first
    When "findAll" is called
    Then 2 Photo objects are returned in the same order

  Scenario: Leaving out photos that cannot be shown
    Given the API lists a photo without renditions
    When "findAll" is called
    Then that photo is not returned

  Scenario: Listing photos from an empty catalogue
    Given the API lists 0 photos
    When "findAll" is called
    Then null is returned

  Scenario: Finding a photo by id
    Given the API knows the photo "a/b"
    When "findById" is called with "a/b"
    Then the API is asked for "/photos/a%2Fb"
    And a Photo is returned

  Scenario: Finding a photo that does not exist
    Given the API answers 404 for "x"
    When "findById" is called with "x"
    Then null is returned

  Scenario: The API fails
    Given the API answers with a 5xx error
    When any lookup is called
    Then it rejects with an error that mentions the status

  Scenario: The API url is not configured
    Given NEXT_PUBLIC_API_URL is not set
    When any lookup is called
    Then it rejects explaining that NEXT_PUBLIC_API_URL is missing
    And no request is sent

  Scenario: Only the API's renditions are loaded
    Given a photo with renditions of 640 and 1280 px
    When its card is rendered
    Then every candidate in the image's src and srcset is one of those renditions

  Scenario: Saving, deleting and collections are not supported yet
    When "save", "delete" or "findCollection" is called
    Then it rejects with an explicit "not implemented" error
