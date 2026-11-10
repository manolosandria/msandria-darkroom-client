Feature: The site header and the account corner
  Every page opens with the full header: the logo and the main links. The account sits
  in the top-right corner of every page, and the header leaves as the page scrolls.

  Scenario: Scrolling the header away
    Given the general settings hide the header on scroll
    When I scroll past the header
    Then the header scrolls away with the page
    And the logo floats in the top-left corner as a link home
    And the account and the "Show header" chevron float in the top-right corner
    When I press "Show header" on a wide screen
    Then the page returns to the top with the header

  Scenario: One chrome, expanded or compact, on a wide screen
    Given I am on any page of the site at 1400 px wide
    When I press the chevron in the top-right corner
    Then the header folds into the floating logo, the page menu and my account
    And inside Curator its row of tabs folds with it
    When I press the chevron again without moving the pointer
    Then the header and Curator's tabs come back
    And the choice holds on every page I open next

  Scenario: Always compact on a phone
    Given I folded the header on a wide screen
    When I open the site on a phone
    Then the header shows its logo, the page menu and my account, with no chevron
    And the site's links and Curator's tabs are in the page menu
    When the general settings hide the header on scroll and I scroll past it
    Then the logo floats and the page menu stays in the corner until I return to the top

  Scenario: A header that stays
    Given the general settings keep the header on scroll
    When I scroll the page
    Then the header stays fixed at the top

  Scenario: My account from the corner
    Given I am signed in
    Then the corner shows my profile photo, or my initial, and my name
    When I open it
    Then I see my cover, photo, name and email
    And I can view my profile, open my account settings or sign out

  Scenario: Signing in from the corner
    Given I am not signed in
    When I open "Sign in" in the corner
    Then Google and the email link are offered in a card under it

  Scenario: General settings in Curator
    Given I am the administrator in Curator → Sections → General
    When I choose the header's tone and material, where its links sit, whether it hides on scroll, the fonts and the main palette
    Then the preview follows my draft
    And nothing changes on the site until I save
    And after saving, the open page adopts them without reloading

  Scenario: Header tones from the palette
    Given I am the administrator in Curator → Sections → General
    Then the light and dark tones of the header are drawn from the main palette
    And a derived tone whose text would be hard to read uses black or white instead
    When I pick a tone's ground or text by hand
    Then it is marked as picked by hand, with a warning if its contrast is under 4.5:1
    And "Use the palette's" returns it to the palette
    When I choose another palette from the library
    Then both tones come from the new palette again

  Scenario: An automatic header
    Given the header's tone is automatic
    When a visitor's system is set to dark mode
    Then the visitor sees the dark tone, and otherwise the light one
