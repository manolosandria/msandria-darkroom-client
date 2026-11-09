Feature: Posts on Home
  As the photographer
  I want to publish posts of text and photographs on Home, with tags and a date
  So that I can tell stories around the photographs without every one joining the gallery

  Scenario: Reading the journal under the carousel
    Given there are published posts
    When I open Home
    Then the journal under the carousel shows five posts, newest first
    And "Older →" and "← Newer" move between pages, kept as ?page= in the address
    And Home shows no journal at all while nothing is published

  Scenario: A photo of the gallery and a posts-only photo
    Given a published post with a photo of the gallery and a posts-only photo
    When I read it
    Then clicking the gallery photo opens its detail view, with its information and comments
    And the posts-only photo is shown without a link and has no detail view

  Scenario: Following a tag
    When I click "#trip" under a post
    Then Home shows only the posts tagged "trip", with "Show all" to return

  Scenario: A post at its own address
    When I open the title of a post
    Then it opens at /post/<id>
    And a draft or a scheduled post is not found by visitors

  Scenario: Liking and saving a post
    Given I am signed in
    When I like a post and save it
    Then the like count goes up and the post appears under "Saved posts" on my account
    But signed out, Like and Save are disabled with a hint to sign in

  Scenario: Writing a post in Curator
    Given I am the administrator in Curator → Posts
    When I start a new post with a title, a text block, photos from the library and tags
    And I reorder the blocks by dragging their grip or with the arrows
    And I choose Published and save
    Then the post appears on Home with its blocks in that order
    And its tags are stored once each, without "#" and in lower case

  Scenario: Uploading photos from the post editor
    Given I am writing a post
    When I choose photo files
    Then each photo offers the same preparation card as Photos, defaulting to "Only in posts"
    And the upload destination appears only after choosing a file
    When I upload the prepared photos
    Then they join the post and stay out of the gallery
    And each photo shows its optimization review
    But with "To the gallery too" they also join the gallery with a detail view

  Scenario: Recovering cancelled changes
    Given I have edited a post
    When I cancel its changes and press Ctrl+Z outside a text field
    Then the cancelled draft is restored, including removed story blocks
    And opening a different post starts a separate undo history

  Scenario: Choosing a publication date
    When I open Publication date
    Then a styled calendar offers month navigation and a separate local hour and minute
    And "When published" clears the scheduled date

  Scenario: Keeping prepared photo edits
    Given I have selected photo files without uploading them yet
    When I preview the post and return to Edit
    Then the prepared photos and their edits are kept
    And leaving the post asks before discarding them
    And their block slots are reserved until uploaded or removed

  Scenario: Drafts and scheduled posts
    When I save a post as a draft, or published with a later date
    Then only Curator shows it, marked Draft or Scheduled, until that date comes

  Scenario: A post that cannot be published
    When I try to publish a post without a title, without blocks or with a private photo
    Then the editor or the API explains why and keeps my edits

  Scenario: Finding a post in the studio
    Given the journal contains drafts, scheduled and published posts
    When I search by title or tag and choose a status filter
    Then the library shows matching posts with their cover, excerpt and status
    And filtering does not discard the story I am editing

  Scenario: Checking the reading experience
    Given I am editing a post
    When I open Preview and choose Phone or Desktop
    Then I see the story at that width without saving it
    And Edit returns to my changes

  Scenario: Waiting for photo uploads
    Given a photo upload is in progress
    Then switching posts, previewing and saving are disabled until it finishes
    And the photo joins the same post when the upload completes
    And files beyond the remaining block capacity are not uploaded
    And the editor explains that uploaded files are stored immediately, before saving the post
