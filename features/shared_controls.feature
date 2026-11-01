Feature: Shared controls in the editors
  Choices look and behave the same in every editor, instead of the browser's own lists
  and boxes.

  Scenario: Choose from a designed menu
    Given an editor offers a list of choices
    When I press its button
    Then a card of options opens under it, the chosen one ticked
    And each option lights up under the pointer, with its drawing, colors or typeface
    And picking one closes the card and shows it on the button

  Scenario: Use the menu from the keyboard
    Given the menu's button has focus
    When I press the arrow keys, Home or End
    Then the lit option moves, skipping the ones that cannot be chosen
    And Enter or Space picks it, Escape closes the card, and typing a name jumps to it

  Scenario: A few options as drawings
    Given a setting has two to four options
    Then they are a row of drawings, each named in a tooltip
    And the chosen one is raised, and one line beside the name says which it is

  Scenario: Nothing to show
    Given a list in Curator has nothing in it
    Then it shows a drawing, a short title and what will appear there

  Scenario: Every control answers the pointer
    Given I point at a button, a checkbox or a slider
    Then the pointer becomes a hand and the control lights up
    And a press darkens it until I let go
