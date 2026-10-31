Feature: Editing the current version of a photo
  Scenario: Another editor saved first
    Given I have unsaved photo edits
    When the API reports a version conflict
    Then the card explains in English that the photo changed
    And my edits remain until I choose Reload state
    When I choose Reload state
    Then the current photo details and version replace my draft

  Scenario: Replace and revisit a private photo
    Given a private photo with categories and collection assignments
    When I replace only its file and revisit the photo in Photos
    Then the editor retains its privacy, categories, collections and new version
    And saving sends only metadata I deliberately changed

  Scenario: Find a photo in the library
    Given I am on the Photos tab as the administrator
    When I search by title or filter by category or camera
    Then the library lists only the matching photos and how many there are

  Scenario: Browse the library as a grid or a list
    Given I am on the Photos tab as the administrator
    When I switch the library from Grid to List
    Then each photo shows as a row with its visibility, size, camera and date
    When I open a photo
    Then the library becomes a filmstrip above the editor
    And Library brings back the grid or list I left

  Scenario: Preview a highlight large and move between sections
    Given I am editing a photo with a square highlight
    When I choose Square above the stage
    Then the stage shows that crop large instead of the whole photo
    When I collapse every section and choose Frame among the section tabs
    Then the Frame section opens and scrolls into view

  Scenario: Arrange the inspector's sections
    Given I am editing a photo
    Then every section shows as a tile in an even grid under the title and its Save button
    And the tile of the section I am reading is marked as I scroll
    When I hide Frame and Variants from the Sections menu
    Then their tiles and sections disappear without losing their edits
    And they stay hidden the next time I open the Photos editor in this browser
    And Details cannot be hidden, because it holds the required title
    When I choose Show all sections
    Then every section is back

  Scenario: Expand and collapse every section at a glance
    Given I am editing a photo with some sections open
    Then a meter between Expand and Collapse shows how many are open
    When I collapse every section
    Then Collapse is disabled and the meter shows none open

  Scenario: Classify a photo visually
    Given I am editing a photo
    Then visibility is chosen among four cards with a picture each
    And existing categories can be added with a click
    When I expand Collections
    Then every collection shows its cover and title, marking the ones holding the photo
    And choosing a card adds or removes the photo, with its order beside it

  Scenario: Replacing the file warns that the current one is lost
    Given I am editing a photo
    When I choose a file with Replace file at the bottom of the editor
    Then a warning says the current file will be lost and cannot be recovered
    And Keep the current file withdraws the replacement before saving

  Scenario: Build a work in the Variants studio
    Given I am in Curator Variants
    When I drag photos from the library into the open work, or tick them there
    Then they appear large in the work, the first as its cover
    When I drop image files on the work or choose Upload files
    Then each file is uploaded with the visibility of the work's first photo and joins the work
    And the work is grouped only when I choose Save variants

  Scenario: Save several custom highlights alongside the main shapes
    Given I am editing a photo with a square highlight
    When I add two named custom highlights with independent widths and heights
    Then both appear as selectable previews
    And the square highlight remains unchanged
    When I remove one custom highlight and save
    Then the other highlight and the main shapes remain saved

  Scenario: Duplicate a main crop into an independent detail
    Given a portrait highlight is selected
    When I duplicate it as a custom highlight and resize its width
    Then the portrait highlight keeps its original proportions

  Scenario: Frame a photo while uploading
    Given I am preparing a photo on the Upload tab
    When I turn on its frame, pick a colour and set the sides and the top and bottom apart
    Then the preview shows the photo inside that frame
    And publishing sends the colour and both thicknesses with the photo

  Scenario: Change or remove the frame of a published photo
    Given a published photo with a white frame
    When I thicken its top and bottom in Photos and save
    Then the photo keeps its colour and sides with the new top and bottom
    When I turn its frame off and save
    Then the photo is shown bare in the viewer and on Home

  Scenario: Draw a highlight and revert a change
    Given I am editing a photo without highlights
    When I press the green plus, choose the square and drag on the photo
    Then a square crop appears that I can move or resize from a corner
    And it is kept only when I accept it, and cancelling leaves nothing behind
    When I move an accepted highlight and choose Revert
    Then it returns to where it was when I opened the photo

  Scenario: Combine Gallery filters
    Given the gallery has categories in Subjects and in Color & treatment
    When I choose two subjects and one color
    Then the gallery shows photos with either subject that also have that color
    And the round reset icon clears every filter at once

  Scenario: Switch variants where the work is shown
    Given a work with two variants
    Then its Gallery tile and the viewer show both as small thumbnails to choose from
    And a collection shows them only when its Display section allows it

  Scenario: Manage palettes in their own tab
    Given I open Curator Palettes
    Then each palette shows its four colors and a drawing says where each one goes
    When I rename a palette and save
    Then the Gallery studio keeps its own draft and adopts the new palettes

  Scenario: See where a palette color goes by pointing at it
    Given I open Curator Palettes
    When I hover over or focus a color row in the palette editor
    Then the row lights up, shows its value and a pencil, and can be clicked anywhere to change the color
    And every zone of the drawing painted with that color is ringed, with its number enlarged
    When I hover over a zone of the drawing
    Then its color row and its legend entry light up
    When I click that zone
    Then the picker for its color opens in the editor
    And choosing a palette in the library or in the drawing's selector shows the same palette in both

  Scenario: Edit one section at a time
    Given I opened a photo in Curator Photos
    Then the inspector shows its sections as tabs, one at a time
    And a section I leave keeps its unsaved edits
    When I choose "All in one scroll"
    Then every section shows in one scroll, and the choice is remembered
