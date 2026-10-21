Feature: Interactive public navigation
  Scenario: Browse the home carousel
    Given several public photographs exist
    When I use the next photograph control on Home
    Then I see the next photograph and its viewer link
    And the position counter updates
    And the carousel does not advance automatically

  Scenario: Open the account disclosure
    Given I am signed in
    When I open the account icon
    Then I see my name, email, account settings and sign out
    When I press Escape
    Then the disclosure closes and focus returns to its icon
