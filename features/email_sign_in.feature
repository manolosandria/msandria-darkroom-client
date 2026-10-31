Feature: Signing in by email
  As a visitor without a Google account, or who prefers not to use it
  I want a sign-in link by email
  So that I can sign in without a password

  Scenario: Ask for a link
    Given nobody is signed in
    When I choose "Sign in by email" and send my address
    Then the page says a link is on its way if the address can receive email
    And it says the same whether or not the address has an account

  Scenario: Open the link
    Given I received a sign-in link
    When I open it in the browser
    Then the token leaves the address bar at once
    And I am signed in

  Scenario: A link works once
    Given I already used a sign-in link
    When I open it again
    Then the page says it expired or was used and offers a new one

  Scenario: Email is not configured
    Given the API cannot send email
    When I ask for a link
    Then the page asks me to use Google instead
