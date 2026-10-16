Feature: Curated collections
  Scenario: Arrange a collection
    Given I am signed in as the administrator
    When I select photos, change their order and choose their width and height
    Then I see a composition preview before saving
    And the same four-column composition scales down on a phone

  Scenario: Filter by category and collection
    Given categories belong to collections and individual photographs
    When I choose a category in the gallery
    Then I see matching photographs and photographs in matching collections
    When I choose a collection
    Then its saved order and tile sizes are used

  Scenario: Choose a variant
    Given two photographs are variants of one work
    Then the gallery shows one tile for that work
    When I choose another variant
    Then its photograph and viewer link replace the previous variant
    And both files retain their own comments

  Scenario: Recover a failed save
    Given I have edited a collection
    When saving fails
    Then my title, categories, order and sizes remain editable
    And no request is automatically replayed

  Scenario: Delete a grouping
    When I confirm deletion of a collection or work
    Then its photographs and comments remain available
