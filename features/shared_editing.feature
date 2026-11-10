Feature: What every Curator editor shares
  Curator's editors answer the same way: who may use them, how they read and save their
  settings, and which files their uploaders take.

  Scenario: An editor waits for the session and is offered to the administrator alone
    Given the session is still being asked for
    When I open Home, Gallery, Palettes, Inbox, Comments, Collections or Photos
    Then the editor says it is loading the session
    When the session arrives and I am not the administrator
    Then the editor says what signing in as the gallery's administrator would let me do

  Scenario: A settings editor keeps my draft when a save fails
    Given I changed Home, Gallery, Palettes or General
    When the API refuses the save because the settings changed
    Then the editor explains why and keeps my draft
    When I choose Reload state
    Then I am asked before my draft is thrown away
    And the saved settings and their version replace it once I agree

  Scenario: Every uploader takes the same files
    When I choose files in Upload, Posts, Collections, Variants or Replace file…
    Then JPEG, PNG, WebP, AVIF and GIF images up to 10 MB are accepted
    And any other file is left out with its name and the reason
