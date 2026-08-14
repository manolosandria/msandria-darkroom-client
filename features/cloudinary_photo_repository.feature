Feature: Cloudinary photo repository
  As the application
  I want the Cloudinary repository to map provider data into domain Photo objects
  So that the rest of the system never depends on Cloudinary directly

  Scenario: Finding an existing photo by id
    Given the static photo catalog contains an entry with id "esferabalero" and title "Esfera"
    When "findById" is called with "esferabalero"
    Then a Photo is returned with title "Esfera" and a generated Cloudinary url

  Scenario: Finding a photo that does not exist
    Given the static photo catalog does not contain id "unknown"
    When "findById" is called with "unknown"
    Then null is returned

  Scenario: Listing all photos
    Given the static photo catalog contains 3 entries
    When "findAll" is called
    Then 3 Photo objects are returned, each mapped through the same rule used by "findById"

  Scenario: Listing photos from an empty catalog
    Given the static photo catalog contains 0 entries
    When "findAll" is called
    Then null is returned

  Scenario: Saving a photo is not supported yet
    When "save" is called with any photo
    Then it rejects with an explicit "not implemented" error

  Scenario: Deleting a photo is not supported yet
    When "delete" is called with any id
    Then it rejects with an explicit "not implemented" error
