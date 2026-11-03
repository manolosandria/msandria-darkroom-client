Feature: Phone menu, "Use as", instant returns and arranging filters

  Scenario: The menu on a phone
    Given I browse on a phone
    Then the header shows the logo, three bars and my account
    When I press the three bars
    Then the links open in a sheet from the bottom
    When I scroll past the header
    Then a round menu button floats on an edge of the window
    When I drag it near another edge
    Then it settles on that edge and stays there on the next page

  Scenario: Using a photograph as my profile photo
    Given I am signed in and viewing a public photograph's info
    When I press "Use as" and choose "Profile photo"
    Then I see my current profile photo beside this one
    And nothing changes until I press "Use as profile photo"
    And the account menu shows the new photo

  Scenario: Coming back is instant, and privacy still holds
    Given I opened a photograph from Gallery and came back
    When I open the same photograph again
    Then it shows at once while it is checked again
    But if it was made private in between, the viewer says it was not found
    And it disappears from the Gallery page when I return

  Scenario: Arranging the filter bar in the preview
    Given I am in Curator → Gallery → Filters
    When I switch on "View options"
    Then it appears in the bar of the full-width preview
    When I drag it by its grip out of the container and above it
    Then a line shows where it will land
    And dropping it there changes the draft, saved only with Save
