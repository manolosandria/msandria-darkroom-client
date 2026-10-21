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
