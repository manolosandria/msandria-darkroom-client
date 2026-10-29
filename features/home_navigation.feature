Feature: Interactive public navigation
  Scenario: Browse the home carousel
    Given several public photographs exist
    When I use the next photograph control on Home
    Then I see the next photograph and its viewer link
    And the position counter updates
    And the carousel does not advance automatically

  Scenario: Choose the Home slides in Curator
    Given the administrator added photographs to the Home slides in Curator
    When a visitor opens Home
    Then the carousel shows exactly those photographs in that order
    And without slides Home draws up to eight eligible photographs at random on each visit

  Scenario: Click the banner to browse it
    When the visitor clicks the banner photograph
    Then nothing opens and the arrow keys move between slides
    And no focus frame appears around the banner
    And only a click on the slide title opens its photo, link or collection

  Scenario: Open the account disclosure
    Given I am signed in
    When I open the account icon
    Then I see my name, email, account settings and sign out
    When I press Escape
    Then the disclosure closes and focus returns to its icon
