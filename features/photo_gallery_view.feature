Feature: Photo fetching view state
  As a visitor
  I want clear loading, error and success states while photos are fetched
  So that I always understand what the page is doing

  Scenario: Photos load successfully
    Given a photo fetcher that resolves with 3 photos
    When the view mounts
    Then a loading indicator is shown first
    And afterwards the 3 photos are displayed
    And no error message is shown

  Scenario: No photos are found
    Given a photo fetcher that resolves with no photos
    When the view mounts
    Then an error message "No photos found" is shown

  Scenario: Fetching photos fails
    Given a photo fetcher that rejects with an error
    When the view mounts
    Then an error message is shown
    And a retry action is available

  Scenario: Retrying after a failure
    Given the view is showing an error after a failed fetch
    When the visitor triggers the retry action
    Then the fetch is attempted again
