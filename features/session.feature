Feature: Signing in with Google
  As a visitor of the gallery
  I want to sign in with my Google account
  So that the site knows who I am and shows me what my role allows

  Background:
    Given the API is reachable
    And NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured

  Scenario: The header asks a visitor without a session to sign in
    Given nobody is signed in
    When the header loads
    Then the Google sign-in button is offered

  Scenario: Signing in greets the visitor by name
    Given nobody is signed in
    When Google hands the page a signed ID token
    Then the token is sent to the API
    And the header greets the visitor by name
    And the sign-in button is no longer offered

  Scenario: The visitor is greeted by email when Google gave no name
    Given a signed-in visitor whose account has no name
    When the header loads
    Then the header greets the visitor by email

  Scenario: The administrator is marked as such
    Given a signed-in administrator
    When the header loads
    Then the header shows the "Admin" mark

  # The mark only reflects the role the API reported. It grants nothing: the API
  # decides what is allowed on every request, reading the role from its own database.
  Scenario: A registered visitor is not marked as administrator
    Given a signed-in registered visitor
    When the header loads
    Then the header does not show the "Admin" mark

  Scenario: The session is restored on a later visit without signing in again
    Given a session cookie left from an earlier visit
    When the header loads
    Then the API is asked who is signed in
    And the header greets the visitor by name

  # The cookie is HttpOnly, so this code cannot read it. Asking the API is the only
  # way to know whether there is a session at all.
  Scenario: The page never reads the session cookie
    Given a signed-in visitor
    When the header loads
    Then the session is learnt from the API's answer, not from the cookie

  Scenario: Signing out ends the session and stops Google offering it back
    Given a signed-in administrator
    When the visitor signs out
    Then the API is asked to delete the session
    And Google is told not to sign the visitor back in automatically
    And the Google sign-in button is offered again

  # Showing a signed-out header while the cookie still works would be a lie.
  Scenario: A sign-out the API could not complete leaves the visitor signed in
    Given a signed-in administrator
    And the API fails to end the session
    When the visitor signs out
    Then the visitor is still shown as signed in
    And the failure is reported

  Scenario: An unreachable API can be retried
    Given the API cannot be reached
    When the header loads
    Then the failure is reported with a retry
    And retrying after the API recovers greets the visitor

  Scenario: Nothing is shown until the first answer arrives
    Given the API has not answered yet
    When the header loads
    Then neither the sign-in button nor the sign-out button is shown

  Scenario: A missing client id is reported instead of a button that cannot work
    Given NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured
    When the header loads
    Then the header says the client id is missing
    And Google's button is not rendered
