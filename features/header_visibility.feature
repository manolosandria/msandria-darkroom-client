Feature: Fold the site header away
  A visitor can put the header away to give the photographs the whole page, and bring
  it back from a slim tab that never covers the content.

  Scenario: Hide the header
    Given I am on any page with the site header
    When I press the hide control beside the account icon
    Then the header folds up and the page moves up into its place
    And a slim "Menu" tab hangs from the top edge of the page
    And focus moves to that tab

  Scenario: Show it again
    Given the header is hidden
    When I press the "Menu" tab
    Then the header unfolds in its place, pushing the page down rather than covering it
    And focus returns to the hide control

  Scenario: The choice follows me
    Given I hid the header
    When I open another page or come back later in the same browser
    Then the header is already hidden, without replaying the animation

  Scenario: Storage is unavailable
    Given the browser refuses site storage
    When I hide the header
    Then it still folds away for as long as the page stays open

  Scenario: The administrator does not miss pending work
    Given I am the administrator with pending comments or messages
    When the header is hidden
    Then the "Menu" tab shows a dot and announces how many are pending

  Scenario: Keyboard, screen readers and reduced motion
    Given I use the keyboard or a screen reader
    Then both controls are buttons that say what they do and whether the header is shown
    And the hidden header's links cannot be reached by Tab
    And with reduced motion the header changes without animating
