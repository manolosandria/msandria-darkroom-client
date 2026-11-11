Feature: Links to the owner's profiles elsewhere
  The administrator lists the owner's profiles on other sites in Curator → General, and
  visitors find them as small icons that never compete with the photographs.

  Scenario: Adding, ordering and saving links
    Given I am the administrator in Curator → General
    When I add a LinkedIn, an Instagram and a YouTube link with their https addresses
    And I move YouTube first and press "Save general settings"
    Then the links are saved in that order, trimmed
    And the preview draws them in the same order

  Scenario: A link the API would refuse
    Given I am the administrator in Curator → General
    When I add a link without an address, or with an http address, or with a user name
    Then saving is refused before anything is sent
    And each link explains what to fix under it
    And an "Other" link asks for its name

  Scenario: Restoring the original look
    Given General has social links
    When I press "Restore original"
    Then the header, fonts and palette return to the original look
    And the social links stay

  Scenario: Visitors following a link
    Given the general settings have social links
    When I reach the end of a public page, or open the page menu beside my account
    Then I see one small icon per link, named for screen readers
    And each opens in a new tab without telling the other site where I came from
    And no icon or script is loaded from the networks themselves

  Scenario: Pages without the footer
    Given the general settings have social links
    When I am in Curator, the photo viewer or an upload screen
    Then no footer is drawn under the screen
    And the page menu still offers the links

  Scenario: No links
    Given the general settings have no social links
    Then no footer and no row of icons is drawn
