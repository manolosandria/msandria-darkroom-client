Feature: Signing in by email
  As a visitor without a Google account, or who prefers not to use it
  I want a one-time code by email
  So that I can sign in without a password

  Scenario: Ask for a code
    Given nobody is signed in
    When I choose "Sign in by email" and send my address
    Then the page says a 6-digit code is on its way if the address can receive email
    And it says the same whether or not the address has an account

  Scenario: Type the code in the same window
    Given I asked for a code
    When I type the 6 digits that arrived, ignoring any spaces or dashes
    Then I am signed in
    And an account is opened for the address if it had none

  Scenario: A wrong or expired code
    Given I asked for a code
    When I type a code that is wrong, expired or already used
    Then the page says so and keeps the code form
    And I can send a new code or change the address

  Scenario: Email is not configured
    Given the API cannot send email
    When I ask for a code
    Then the page asks me to use Google instead
