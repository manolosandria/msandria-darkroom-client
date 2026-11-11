Feature: Compact highlight visibility controls
  Scenario: Enable only the selected view everywhere it fits
    Given a photograph with an original and a square highlight
    When I select the square highlight and choose Show everywhere
    Then it is enabled in Home and all three Gallery layouts as a square
    And the original view keeps its existing destinations
    When I choose Hide everywhere
    Then that highlight has no Home or Gallery destinations
    And its thumbnail says Hidden

  Scenario: Discover size icons without changing the crop
    Given the Original size is selected
    When I point at or focus the Portrait size icon
    Then the shared label describes Portrait
    And Original remains selected until I click another size

  Scenario: Show concise compatible options
    When I open a highlight's visibility controls
    Then only the three compatible Gallery layout checkboxes appear
    And the explanation can be opened with the information icon
