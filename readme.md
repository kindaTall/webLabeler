# Adding labels to be displayed

In `Backend/db_interface.py`, ensure that the subclassed `class DBInterface(abc.ABC)` returns the appropriate labels and probabilities when loading an item and can handle it when saving. See the methods `load_file` and `set_file_yconfig` for implementation details.

In `html/plotConfig.js`, add the labels to the plot by adding line definitions. See the `series` configuration for how to define the labels. 