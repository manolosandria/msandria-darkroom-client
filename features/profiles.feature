Feature: Profiles, likes and favorites
  As a visitor with an account
  I want to like and save photographs and show a profile if I choose
  So that others can know who comments, without the site becoming a social network

  Scenario: A new profile is private
    Given I am signed in for the first time
    When I open my account
    Then my profile, likes and favorites are private
    And others who open my profile see only my public name

  Scenario: Profile photo and cover come from the public gallery
    Given I am signed in
    When I choose a cover on my account
    Then I pick among the photographs of the public gallery
    And a photograph that is not public is refused

  Scenario: A public author is a link with a card
    Given a comment whose author has a public profile
    When I point at the author's name
    Then a card shows their photo, cover, name and email
    And the name links to their profile

  Scenario: A private author shows only their name
    Given a comment whose author's profile is private
    Then the comment shows only the name they chose, without a link

  Scenario: Like and save a photograph
    Given I am signed in and viewing a photograph
    When I press "Like"
    Then the like count goes up by one
    When I press "Save"
    Then the photograph is among my favorites

  Scenario: Signed out, the count shows but nothing can be pressed
    Given nobody is signed in
    When I open a photograph's information
    Then I see how many likes it has
    And Like and Save ask me to sign in
