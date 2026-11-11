Feature: Compact gallery feedback and photo controls
  Scenario: An empty selection offers a way forward
    Given my gallery filters match no photographs
    Then I see that the selection is empty
    And I am invited to change the search or clear the filters

  Scenario: Photo quality labels stay within reach
    Given I am viewing a photograph
    Then the current quality level is labelled
    When I focus the quality controls with the keyboard
    Then the labels of all quality levels are revealed
