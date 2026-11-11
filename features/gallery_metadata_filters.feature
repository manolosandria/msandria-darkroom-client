Feature: Gallery filters by camera, exposure and tone
  Visitors narrow Gallery by how a photograph was taken and by whether it is in colour
  or black and white. The API filters before paging; this site only offers the choices.

  Scenario: The filters panel offers the photographs' own equipment and ranges
    Given the public photographs were taken with two cameras and one lens
    When the visitor opens Filters
    Then a "Camera & exposure" department lists the tone, the cameras and the lens
    And focal length, shutter speed, aperture and ISO offer a range only when they vary
    And without facets from the API the department is not offered

  Scenario: Choosing metadata filters
    When the visitor chooses Black & white, a camera and a shutter speed range
    Then the page asks the API again from page 1 with those filters
    And a range is sent a moment after its slider stops, not on every step
    And each choice shows as a chip with its department, which removes it
    And photographs without that data are left out only while that filter applies

  Scenario: The filters travel in the URL
    Given a link with cameras, lenses, ranges and a tone
    When Gallery opens from it
    Then the same filters apply, cameras and lenses each as a repeated parameter
    And values the API would refuse are dropped

  Scenario: Reset clears every filter
    When the visitor presses the reset icon
    Then categories, cameras, lenses, ranges and tone are all cleared

  Scenario: The administrator corrects the tone
    Given a photograph the API measured as colour
    When the administrator chooses Black & white under Details in Curator's Photos
    Then saving sends the tone with the photo's version

  Scenario: Classifying older photographs
    Given photographs uploaded before the API measured their tone
    When the administrator presses "Classify them" in Curator's Photos
    Then batches are classified until none remain or a batch classifies nothing
    And photographs whose file could not be read are counted and stay pending
