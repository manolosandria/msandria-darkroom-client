Feature: Curated collections
  Scenario: Arrange a collection
    Given I am signed in as the administrator
    When I add photos, drag them into a new order and pull their edges to resize them
    Then the canvas shows the composition before saving
    And the same four-column composition scales down on a phone

  Scenario: Browse collections
    Given I open the Collections tab of the catalog editor
    Then I see each collection as a card with its cover and title
    When I choose one
    Then the side panel shows its categories, description and photo thumbnails
    And I can open it to edit or start a new collection

  Scenario: Find photos to add
    Given I am editing a collection
    When I search the Add photos strip by title or choose a category
    Then only matching photos that are not already in the collection are offered
    And the strip scrolls sideways, loading 160-pixel thumbnails with their titles as they appear

  Scenario: Edit a photo from the side panel
    Given I am editing a collection
    When I click one of its photos
    Then the side panel shows its position, size and whether its title is shown
    And I can use it as the collection cover or remove it
    And the same changes are possible without dragging

  Scenario: Hide a photo's title in a collection
    Given a photo in a collection whose title is hidden
    Then the collection mosaic in the gallery shows that photo without its caption

  Scenario: Warn about private photos
    Given a private or reserved photo is in a collection
    Then its tile is framed with an exclamation mark
    And a warning above the canvas says it will not appear in the public collection

  Scenario: Filter by category and open a collection
    Given categories belong to collections and individual photographs
    When I choose a category in the gallery
    Then I see matching photographs and photographs in matching collections
    When I open Collections from the header and choose a collection
    Then its saved order and tile sizes are used

  Scenario: Choose a variant
    Given two photographs are variants of one work
    Then the gallery shows one tile for that work
    When I choose another variant
    Then its photograph and viewer link replace the previous variant
    And both files retain their own comments

  Scenario: Recover a failed save
    Given I have edited a collection
    When saving fails
    Then my title, categories, order and sizes remain editable
    And no request is automatically replayed

  Scenario: Delete a grouping
    When I confirm deletion of a collection or work
    Then its photographs and comments remain available

  Scenario: Browse twelve random photographs per page
    Given more than twelve public photographs are available
    When I open Gallery
    Then I see twelve photographs in a shuffled order
    And changing pages preserves that order without repeating photographs
    And selecting a category returns me to the first page

  Scenario: Choose a collection from its cover
    When I open Collections from the header
    Then I see a grid with each collection's cover, title and description
    When I choose a collection
    Then I see its saved mosaic
    And I can return to the collection grid

  Scenario: Manage variants from their own Curator section
    When I open Variants in Curator and select a work cover
    Then I see its selected variant thumbnails and can edit the group
    And Variants is not a subtab of Collections

  Scenario: Link a variant while uploading
    Given I select an existing photograph as the variant target for an upload
    When the upload succeeds but linking fails
    Then retry links the already uploaded photo without uploading it again

  Scenario: Choose the saved collection variant
    Given I select a collection entry with variants
    When I choose another collection variant
    Then its position, dimensions, caption visibility and cover selection are preserved

  Scenario: Exclude nonmatching variants
    Given a work has variants in different categories
    When I filter by one of those categories
    Then I see one tile with only its matching variants

  Scenario: Switch variants in the viewer
    Given I open a photograph with accessible variants
    Then thumbnail links let me view those variants at their own URLs

  Scenario: Browse grouped gallery categories
    Given categories include subjects, colors, themes and unrecognized names
    And the curator has not arranged departments
    When I open Gallery
    Then the browse bar offers Subjects, Color & treatment and Themes as departments
    And unrecognized names remain available under Other
    And there is no duplicate category dropdown
    When I press the round reset icon
    Then the category filter is cleared

  Scenario: Configure the archive in Curator
    Given I am an administrator in the Gallery section of Curator
    When I add, remove or edit introduction blocks and change their font and size
    Then I see the unsaved design in the desktop or mobile preview
    And I can assign categories to groups and choose inherited or custom category appearances
    When I save the design
    Then other visitors see the saved design
    And stale saves are rejected without losing the draft

  Scenario: Compact category navigation
    When I hover a category group with the mouse or tap its button on a phone
    Then its category options open below the group bar
    When I select a category
    Then the options close and its saved palette and font apply
    And Escape closes the options and returns focus to the group

  Scenario: Random emphasis without reshuffling during navigation
    Given random emphasis is selected for Gallery
    Then each page has at most two large photographs and the remaining tiles are small
    And returning to a page preserves its priorities
    And a phone shows a compact multi-column composition
    And opening a photograph shows its complete composition

  Scenario: Fill the random mosaic using eligible views
    Given a shuffled page contains landscape and portrait photographs
    Then the random layout fills its rectangle without empty cells or repeated photos
    And portraits span two rows unless an enabled horizontal or square crop is chosen
    And desktop and phone arrangements each have at most two emphasis tiles
    And navigating back preserves the selected views and arrangement

  Scenario: Search the archive
    When I search for a photo title or an assigned category name
    Then only matching eligible photographs and variants are shown
    And the gallery returns to its first page

  Scenario: Select random presentation crops
    Given I am editing a photograph's highlights in Curator Photos
    When I enable an original or highlight separately for Gallery and Home
    And save the photo
    Then those destinations use only their enabled views
    And deleting a crop also removes its presentation references
    And an empty destination excludes the photo there

  Scenario: Offer only configured gallery choices
    Given Curator enables selected distributions and view aspects
    When a visitor changes the distribution or view aspect
    Then only enabled original or crop views for that matrix cell are shown
    And natural proportions preserve the chosen view's aspect ratio
    And changing display controls resets pagination without reshuffling the photos

  Scenario: Edit a palette library
    Given I am editing Gallery as the administrator
    When I edit, add, apply or delete a palette
    Then changes appear in the draft and publish only after Save gallery
    And deleting a library palette retains previously applied design colors

  Scenario: Reach hover options without a gap
    When I move from a department into the open panel
    Then the panel stays open until I choose a category, press Done or leave it
    And the photo count stays in the bar, outside the panel

  Scenario: Start a collection from the plasma card
    Given I am on Curator Collections
    Then the New collection card shows a slowly moving plasma behind a glass plus
    And with reduced motion requested the plasma stands still
    When I choose the card
    Then an empty collection editor opens

  Scenario: Compose on an eight-column grid
    Given I am editing a collection
    When I add a photo
    Then it takes two by two cells of an eight-column grid
    And dragging its edges or corner shows its size and resizes it up to eight cells
    And collections saved on the old four-column grid keep their look

  Scenario: Lay out the collection for phones
    Given I am editing a collection
    When I switch the canvas to Phones
    Then the composition shows in a phone frame on four columns, in the same order
    And pieces I have not resized follow their wide size with its proportion
    When I resize a piece there
    Then that piece keeps its own phone size and its wide size is unchanged
    And clearing Own size on phones makes it follow the wide size again
    And visitors on narrow screens see the phone layout

  Scenario: Write text blocks between photos
    Given I am editing a collection
    When I add a text block and write a heading, paragraph or quote
    And choose its alignment, size and place among the photos
    Then the public collection shows it at that place in that style
    And an empty text block keeps the collection from saving until it is written or removed
    And the text stays before the same photo when photos are added or removed elsewhere

  Scenario: Give a photo its own text
    Given I am editing a collection
    When I write text with a photo
    Then it shows under the photo inside the same piece
    And hovering or focusing the piece outlines and lifts photo and text together

  Scenario: Change the view shape while the next page loads
    Given the gallery shows photos without a square view
    When a visitor chooses Square views
    Then the page keeps working while the new selection loads
    And photos without a view for that shape are left out instead of breaking the grid
    And an empty selection says that no photos match
