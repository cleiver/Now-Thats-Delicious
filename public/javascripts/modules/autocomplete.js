function autocomplete(input, latInput, lngInput) {
  if (!input) return;

  const dropdown = new google.maps.places.Autocomplete(input);

  dropdown.addListener("place_changed", () => {
    const place = dropdown.getPlace();

    latInput.value = place.geometry.location.lat();
    lngInput.value = place.geometry.location.lng();

    // prevents submiting the form in case enter key is pressed
    input.on("keydown", e => {
      // ^^^ thanks bling ^^^
      if (e.keyCode === 13) e.preventDefault();
    });
  });
}

export default autocomplete;
