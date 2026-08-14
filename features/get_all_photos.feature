Feature: Retrieve all photos
  As a visitor of the gallery
  I want to fetch every available photo
  So that I can browse the collection

  Scenario: Repository has photos
    Given a photo repository containing 3 photos
    When the "GetAllPhotos" use case is executed
    Then it returns the 3 photos from the repository

  Scenario: Repository has no photos
    Given a photo repository containing no photos
    When the "GetAllPhotos" use case is executed
    Then it returns null

  Scenario: Repository fails
    Given a photo repository that fails to fetch
    When the "GetAllPhotos" use case is executed
    Then the failure propagates to the caller
