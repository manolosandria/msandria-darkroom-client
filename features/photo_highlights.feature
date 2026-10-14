
Feature: Photo upload workspace and manual highlights
  Scenario: Publish multiple photographs sequentially
    Given the administrator selects several photographs
    When they edit each title and description and publish the queue
    Then only one upload request is in flight at a time
    And each photograph keeps its own optimization report

  Scenario: Retry a rejected photograph
    Given one photograph fails while another publishes successfully
    When the administrator publishes again
    Then only the failed photograph is retried with its edits preserved

  Scenario: Select optional thumbnail crops
    Given a photograph is selected for upload
    When the administrator adds a square, landscape or portrait highlight
    Then they can move and resize it inside the oriented photograph
    And a thumbnail preview shows the selected region
    And any or all highlights may be omitted or removed

  Scenario: Edit published highlights
    Given the administrator opens a published photograph in the management screen
    When they save its title, description and highlights
    Then the existing photograph is updated without another file upload
