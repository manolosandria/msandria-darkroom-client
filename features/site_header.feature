Feature: The site header and the account corner
  Every page opens with the full header: the logo and the main links. The account sits
  in the top-right corner of every page, and the header leaves as the page scrolls.

  Scenario: Scrolling the header away
    Given the general settings hide the header on scroll
    When I scroll past the header
    Then the header scrolls away with the page
    And the logo floats in the top-left corner and opens the menu on hover or focus
    And the account and the "Show header" chevron float in the top-right corner
    When I press "Show header"
    Then the page returns to the top with the header

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
    When I choose the header style, where its links sit, whether it hides on scroll, the fonts and the main palette
    Then the preview follows my draft
    And nothing changes on the site until I save
    And after saving, the open page adopts them without reloading
