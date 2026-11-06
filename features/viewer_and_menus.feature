Feature: Phone menu, "Use as", instant returns and arranging filters

  Scenario: The menu on a phone
    Given I browse Gallery on a phone
    Then the header shows the logo, a "Gallery" menu and my account, and no three bars
    When I open the "Gallery" menu
    Then it lists the site's pages
    And as the administrator it also lists every Curator group
    When I scroll past the header
    Then the same menu stays in the corner, and no other menu button floats

  Scenario: A studio's tabs on a phone
    Given I edit Home in Curator on a phone
    When I scroll past its property tabs
    Then they wait folded on the left edge
    When I unfold them and choose Palette
    Then the Palette controls show and the page scrolls back to them

  Scenario: Folded Curator tabs on a small monitor
    Given I am in Curator at 980 px wide
    Then Home's preview and properties sit side by side
    When I hide the tabs
    Then no empty row is left, and the pill beside my account offers "Show Curator's tabs"

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
